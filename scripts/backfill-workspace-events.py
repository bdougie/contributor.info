#!/usr/bin/env python3
"""
Backfill GitHub Events Cache for Workspace Repositories
Populates github_events_cache table with events from repositories in workspaces
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, List, Dict

import psycopg2
import requests
from dotenv import load_dotenv

load_dotenv()

class WorkspaceEventsBackfill:
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.db_password = os.getenv("SUPABASE_DB_PASSWORD")
        self.github_token = os.getenv("GITHUB_TOKEN")

        if not self.supabase_url or not self.db_password:
            raise ValueError("SUPABASE_URL and SUPABASE_DB_PASSWORD are required")
        
        if not self.github_token or self.github_token.startswith("your_"):
            raise ValueError("Valid GITHUB_TOKEN is required")

        # Setup database connection
        project_id = self.supabase_url.replace("https://", "").split(".")[0]
        self.pg_conn = psycopg2.connect(
            host="aws-0-us-west-1.pooler.supabase.com",
            database="postgres",
            user=f"postgres.{project_id}",
            password=self.db_password,
            port=6543,
        )
        self.pg_cursor = self.pg_conn.cursor()

        # GitHub API setup
        self.github_headers = {
            "Authorization": f"token {self.github_token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "contributor.info-workspace-backfill"
        }

        self.backfill_days = 30
        self.stats = {
            "repos_processed": 0,
            "events_fetched": 0,
            "events_inserted": 0,
            "api_calls": 0,
            "errors": 0,
        }

    def get_workspace_repositories(self, workspace_id: str = None) -> List[Dict[str, str]]:
        """Get all repositories from workspaces"""
        if workspace_id:
            query = """
                SELECT r.owner, r.name, w.name as workspace_name
                FROM workspace_repositories wr
                JOIN repositories r ON wr.repository_id = r.id
                JOIN workspaces w ON wr.workspace_id = w.id
                WHERE wr.workspace_id = %s
            """
            self.pg_cursor.execute(query, (workspace_id,))
        else:
            query = """
                SELECT r.owner, r.name, w.name as workspace_name
                FROM workspace_repositories wr
                JOIN repositories r ON wr.repository_id = r.id
                JOIN workspaces w ON wr.workspace_id = w.id
                ORDER BY w.name, r.owner, r.name
            """
            self.pg_cursor.execute(query)
        
        return [
            {"owner": row[0], "name": row[1], "workspace": row[2]}
            for row in self.pg_cursor.fetchall()
        ]

    def get_repo_events(self, owner: str, name: str, days_back: int = 30) -> List[Dict[Any, Any]]:
        """Fetch events for a repository from GitHub API"""
        print(f"🔍 Fetching events for {owner}/{name}...")
        
        events = []
        page = 1
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_back)
        
        while page <= 10:  # Limit pages to avoid rate limiting
            url = f"https://api.github.com/repos/{owner}/{name}/events"
            
            try:
                response = requests.get(
                    url,
                    headers=self.github_headers,
                    params={"page": page, "per_page": 100},
                    timeout=30
                )
                self.stats["api_calls"] += 1
                
                if response.status_code == 404:
                    print(f"   ⚠️  Repository {owner}/{name} not found")
                    break
                elif response.status_code == 403:
                    print(f"   ⚠️  Rate limited or forbidden for {owner}/{name}")
                    if "X-RateLimit-Reset" in response.headers:
                        reset_time = int(response.headers["X-RateLimit-Reset"])
                        wait_time = max(0, reset_time - int(time.time()) + 60)
                        if wait_time < 3600:  # Only wait up to 1 hour
                            print(f"   ⏳ Waiting {wait_time} seconds for rate limit reset...")
                            time.sleep(wait_time)
                            continue
                    break
                elif response.status_code != 200:
                    print(f"   ❌ Error {response.status_code} for {owner}/{name}")
                    break
                
                page_events = response.json()
                
                if not page_events:
                    break
                
                # Filter events by date and type
                for event in page_events:
                    event_date = datetime.fromisoformat(
                        event["created_at"].replace("Z", "+00:00")
                    )
                    if event_date >= cutoff_date:
                        # Only collect relevant event types
                        if event["type"] in [
                            "WatchEvent", "ForkEvent", "PullRequestEvent", 
                            "IssuesEvent", "StarEvent"
                        ]:
                            events.append(event)
                    else:
                        # Events are ordered by date, so we can stop
                        print(f"   📅 Reached cutoff date at page {page}")
                        self.stats["events_fetched"] += len(events)
                        return events
                
                page += 1
                time.sleep(0.5)  # Be nice to GitHub API
                
            except Exception as e:
                print(f"   ❌ Error fetching {owner}/{name}: {e}")
                self.stats["errors"] += 1
                break
        
        self.stats["events_fetched"] += len(events)
        print(f"   ✅ Found {len(events)} events for {owner}/{name}")
        return events

    def insert_event(self, event: Dict[Any, Any]) -> bool:
        """Insert event into github_events_cache"""
        try:
            repo_full_name = event["repo"]["name"]
            repository_owner, repository_name = repo_full_name.split("/", 1)
            
            # Create payload
            payload = {
                "action": event.get("action"),
                "actor": {
                    "id": event["actor"]["id"],
                    "login": event["actor"]["login"],
                    "avatar_url": event["actor"]["avatar_url"],
                },
                "repo": {
                    "id": event["repo"]["id"],
                    "name": event["repo"]["name"],
                    "url": event["repo"]["url"],
                },
                "public": event["public"],
                "backfill_source": "workspace_backfill",
                "backfill_date": datetime.now(timezone.utc).isoformat(),
            }
            
            # Add event-specific payload
            if "payload" in event:
                payload.update(event["payload"])
            
            self.pg_cursor.execute(
                """
                INSERT INTO github_events_cache
                (event_id, event_type, actor_login, repository_owner, repository_name, payload, created_at, processing_notes)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (event_id, created_at) DO UPDATE SET
                    processed_at = NOW(),
                    processing_notes = COALESCE(github_events_cache.processing_notes, '') || '; Updated from workspace backfill'
                """,
                (
                    event["id"],
                    event["type"],
                    event["actor"]["login"],
                    repository_owner,
                    repository_name,
                    json.dumps(payload),
                    event["created_at"],
                    f"Workspace backfill on {datetime.now().isoformat()}",
                ),
            )
            
            self.stats["events_inserted"] += 1
            return True
            
        except Exception as e:
            print(f"   ❌ Error inserting event {event.get('id', 'unknown')}: {e}")
            self.stats["errors"] += 1
            return False

    def backfill_repository(self, owner: str, name: str, workspace: str) -> None:
        """Backfill events for a single repository"""
        print(f"\n🚀 Backfilling {owner}/{name} (workspace: {workspace})")
        
        # Get events from GitHub API
        events = self.get_repo_events(owner, name, self.backfill_days)
        
        if not events:
            print(f"   ⚠️  No events found for {owner}/{name}")
            return
        
        # Insert events
        inserted_count = 0
        failed_count = 0
        
        for event in events:
            try:
                if self.insert_event(event):
                    inserted_count += 1
                    self.pg_conn.commit()
                    
                    # Show progress for first few events
                    if inserted_count <= 3:
                        emoji = "🌟" if event["type"] == "WatchEvent" else "📝"
                        print(f"   {emoji} {event['actor']['login']} {event['type']}")
                else:
                    failed_count += 1
                    self.pg_conn.rollback()
            except Exception as e:
                failed_count += 1
                print(f"   ❌ Failed to insert event: {e}")
                self.pg_conn.rollback()
        
        print(f"   ✅ Inserted {inserted_count}/{len(events)} events")
        if failed_count > 0:
            print(f"   ⚠️  Failed to insert {failed_count} events")
        
        self.stats["repos_processed"] += 1

    def run_backfill(self, workspace_id: str = None) -> None:
        """Run backfill for all workspace repositories"""
        print("🔄 Starting Workspace GitHub Events Backfill")
        print(f"📅 Backfill period: {self.backfill_days} days")
        
        # Get repositories
        repositories = self.get_workspace_repositories(workspace_id)
        
        if not repositories:
            print("❌ No repositories found in workspaces")
            return
        
        print(f"📊 Found {len(repositories)} repositories across workspaces")
        
        start_time = datetime.now()
        
        for i, repo in enumerate(repositories, 1):
            print(f"\n[{i}/{len(repositories)}] Processing {repo['owner']}/{repo['name']}")
            
            try:
                self.backfill_repository(repo["owner"], repo["name"], repo["workspace"])
                
                # Small delay between repos
                if i < len(repositories):
                    time.sleep(2)
                    
            except KeyboardInterrupt:
                print("\n🛑 Backfill interrupted by user")
                break
            except Exception as e:
                print(f"   ❌ Failed to process {repo['owner']}/{repo['name']}: {e}")
                self.stats["errors"] += 1
                continue
        
        # Final statistics
        end_time = datetime.now()
        duration = end_time - start_time
        
        print("\n📊 Backfill Complete!")
        print(f"   Duration: {duration}")
        print(f"   Repositories processed: {self.stats['repos_processed']}")
        print(f"   Events fetched: {self.stats['events_fetched']}")
        print(f"   Events inserted: {self.stats['events_inserted']}")
        print(f"   API calls made: {self.stats['api_calls']}")
        print(f"   Errors encountered: {self.stats['errors']}")
        
        # Show final count
        self.pg_cursor.execute("SELECT COUNT(*) FROM github_events_cache")
        total_events = self.pg_cursor.fetchone()[0]
        print(f"   Total events in github_events_cache: {total_events}")

    def close(self):
        """Clean up connections"""
        if self.pg_conn:
            self.pg_conn.close()


def main():
    """Main function"""
    workspace_id = None
    if len(sys.argv) > 1:
        workspace_id = sys.argv[1]
        print(f"🎯 Backfilling specific workspace: {workspace_id}")
    else:
        print("🌍 Backfilling all workspace repositories")
    
    backfill = WorkspaceEventsBackfill()
    
    try:
        backfill.run_backfill(workspace_id)
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        return 1
    finally:
        backfill.close()
    
    return 0


if __name__ == "__main__":
    sys.exit(main())