import { inngest } from '../client';
import { supabase } from '../supabase-server';

/**
 * Cron job to distill raw tapes sessions into structured knowledge insights.
 *
 * Reads recent sessions from tapes_sessions, groups by project,
 * summarizes with gpt-4o-mini, and stores structured insights
 * in tapes_knowledge with a 30-day TTL.
 *
 * Runs daily at 4 AM UTC.
 */
export const distillSessionKnowledge = inngest.createFunction(
  {
    id: 'distill-session-knowledge',
    name: 'Distill Session Knowledge (Cron)',
    retries: 1,
    concurrency: { limit: 1, key: 'distill-knowledge' },
  },
  { cron: '0 4 * * *' }, // Run daily at 4 AM UTC
  async ({ step }) => {
    console.log('[Distill Knowledge] Starting session knowledge distillation');

    // Step 1: Find projects with recent unprocessed sessions
    const projects = await step.run('find-projects-with-sessions', async () => {
      // Get sessions from the last 24 hours that haven't been distilled yet
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('tapes_sessions')
        .select('project')
        .gte('created_at', oneDayAgo)
        .order('project');

      if (error) {
        console.error('[Distill Knowledge] Error fetching projects: %s', error.message);
        return [];
      }

      // Deduplicate projects
      const uniqueProjects = [...new Set(data?.map((row) => row.project) ?? [])];
      console.log(
        '[Distill Knowledge] Found %d projects with recent sessions',
        uniqueProjects.length
      );
      return uniqueProjects;
    });

    if (projects.length === 0) {
      console.log('[Distill Knowledge] No projects with recent sessions, skipping');
      return {
        success: true,
        projectsProcessed: 0,
        completedAt: new Date().toISOString(),
      };
    }

    // Step 2: Process each project (capped to avoid runaway costs)
    const MAX_PROJECTS_PER_RUN = 10;
    const projectsToProcess = projects.slice(0, MAX_PROJECTS_PER_RUN);
    let totalInsights = 0;

    for (const project of projectsToProcess) {
      const result = await step.run(`distill-${project}`, async () => {
        // Fetch recent sessions for this project
        const { data: sessions, error: sessionsError } = await supabase
          .from('tapes_sessions')
          .select('id, role, content, created_at')
          .eq('project', project)
          .order('created_at', { ascending: false })
          .limit(50);

        if (sessionsError || !sessions?.length) {
          console.error(
            '[Distill Knowledge] Error fetching sessions for %s: %s',
            project,
            sessionsError?.message
          );
          return { insightsCreated: 0 };
        }

        // Build a conversation summary from raw sessions
        const conversationText = sessions
          .reverse()
          .map((s) => `${s.role}: ${s.content}`)
          .join('\n\n');

        // Use OpenAI to distill insights
        const openaiApiKey = process.env.OPENAI_API_KEY;
        if (!openaiApiKey) {
          console.error('[Distill Knowledge] OPENAI_API_KEY not configured');
          return { insightsCreated: 0 };
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are an analyst that extracts structured insights from StarSearch conversations about GitHub repositories.

Given a conversation history, extract 1-5 key insights. Each insight should be one of these types:
- "trend": A pattern or trend observed over time
- "recommendation": An actionable suggestion for the project
- "fact": A notable data point or metric
- "observation": A general observation about the project

Respond with a JSON object containing an "insights" key with an array of objects, each with "type" (one of the above) and "content" (a concise natural language insight, 1-2 sentences max).

Only include meaningful, non-obvious insights. If the conversation is trivial, return {"insights": []}.`,
              },
              {
                role: 'user',
                content: `Repository: ${project}\n\nConversation:\n${conversationText.slice(0, 8000)}`,
              },
            ],
            temperature: 0.3,
            max_tokens: 1000,
            response_format: { type: 'json_object' },
          }),
        });

        if (!response.ok) {
          console.error(
            '[Distill Knowledge] OpenAI API error for %s: %d',
            project,
            response.status
          );
          return { insightsCreated: 0 };
        }

        const completion = await response.json();
        const rawContent = completion.choices?.[0]?.message?.content;

        if (!rawContent) {
          return { insightsCreated: 0 };
        }

        interface DistilledInsight {
          type: string;
          content: string;
        }

        let insights: DistilledInsight[];
        try {
          const parsed = JSON.parse(rawContent);
          insights = Array.isArray(parsed) ? parsed : (parsed.insights ?? []);
        } catch {
          console.error('[Distill Knowledge] Failed to parse OpenAI response for %s', project);
          return { insightsCreated: 0 };
        }

        if (insights.length === 0) {
          return { insightsCreated: 0 };
        }

        const validTypes = ['trend', 'recommendation', 'fact', 'observation'];
        const sessionIds = sessions.map((s) => s.id);
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const knowledgeRows = insights
          .filter((i) => validTypes.includes(i.type) && i.content)
          .map((insight) => ({
            project,
            insight_type: insight.type,
            content: insight.content,
            source_sessions: sessionIds,
            expires_at: expiresAt,
          }));

        if (knowledgeRows.length === 0) {
          return { insightsCreated: 0 };
        }

        const { error: insertError } = await supabase.from('tapes_knowledge').insert(knowledgeRows);

        if (insertError) {
          console.error(
            '[Distill Knowledge] Insert error for %s: %s',
            project,
            insertError.message
          );
          return { insightsCreated: 0 };
        }

        console.log(
          '[Distill Knowledge] Created %d insights for %s',
          knowledgeRows.length,
          project
        );
        return { insightsCreated: knowledgeRows.length };
      });

      totalInsights += result.insightsCreated;
    }

    console.log(
      '[Distill Knowledge] Completed: %d projects processed (%d total found), %d insights',
      projectsToProcess.length,
      projects.length,
      totalInsights
    );

    return {
      success: true,
      projectsProcessed: projectsToProcess.length,
      projectsFound: projects.length,
      totalInsights,
      completedAt: new Date().toISOString(),
    };
  }
);
