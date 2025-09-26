// Comprehensive PR query that fetches all data in a single request
export const GET_PR_COMPLETE_DATA = `
  query GetPullRequestCompleteData($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        id
        databaseId
        number
        title
        body
        state
        isDraft
        createdAt
        updatedAt
        closedAt
        mergedAt
        merged
        mergeable
        
        # Author information
        author {
          login
          avatarUrl
          ... on User {
            id: databaseId
            type: __typename
          }
          ... on Bot {
            id: databaseId
            type: __typename
          }
        }
        
        # Merge information
        mergedBy {
          login
          avatarUrl
          ... on User {
            id: databaseId
            type: __typename
          }
        }
        
        # File changes
        additions
        deletions
        changedFiles
        commits {
          totalCount
        }
        
        # Reviews with details
        reviews(first: 100) {
          totalCount
          nodes {
            id
            databaseId
            state
            body
            submittedAt
            author {
              login
              avatarUrl
              ... on User {
                id: databaseId
                type: __typename
              }
            }
            commit {
              oid
            }
          }
        }
        
        # Review comments (code comments)
        reviewComments(first: 100) {
          totalCount
          nodes {
            id
            databaseId
            body
            createdAt
            updatedAt
            position
            originalPosition
            diffHunk
            path
            author {
              login
              avatarUrl
              ... on User {
                id: databaseId
                type: __typename
              }
            }
            inReplyTo {
              id
              databaseId
            }
            pullRequestReview {
              id
              databaseId
            }
          }
        }
        
        # Issue comments (general PR comments)
        comments(first: 100) {
          totalCount
          nodes {
            id
            databaseId
            body
            createdAt
            updatedAt
            author {
              login
              avatarUrl
              ... on User {
                id: databaseId
                type: __typename
              }
            }
          }
        }
        
        # Branch information
        baseRefName
        headRefName
        headRepositoryOwner {
          login
        }
        
        # Files (limited to avoid excessive cost)
        files(first: 100) {
          totalCount
          nodes {
            path
            additions
            deletions
            changeType
          }
        }
      }
    }
    
    # Rate limit information
    rateLimit {
      limit
      cost
      remaining
      resetAt
    }
  }
`;

// Batch query for multiple PRs (use with caution due to cost)
export const GET_MULTIPLE_PRS = `
  query GetMultiplePRs($owner: String!, $repo: String!, $numbers: [Int!]!) {
    repository(owner: $owner, name: $repo) {
      pullRequests(first: 10, orderBy: {field: CREATED_AT, direction: DESC}) {
        nodes {
          ... on PullRequest {
            ...PRBasicFragment
          }
        }
      }
    }
    
    rateLimit {
      limit
      cost
      remaining
      resetAt
    }
  }
  
  fragment PRBasicFragment on PullRequest {
    id
    databaseId
    number
    title
    body
    state
    isDraft
    createdAt
    updatedAt
    closedAt
    mergedAt
    merged
    mergeable
    additions
    deletions
    changedFiles
    
    author {
      login
      avatarUrl
      ... on User {
        id: databaseId
      }
    }
    
    mergedBy {
      login
      avatarUrl
      ... on User {
        id: databaseId
      }
    }
    
    baseRefName
    headRefName
  }
`;

// Query for recent PRs with basic info (for discovering what to process)
export const GET_RECENT_PRS = `
  query GetRecentPRs($owner: String!, $repo: String!, $since: DateTime!, $first: Int = 50) {
    repository(owner: $owner, name: $repo) {
      pullRequests(
        first: $first,
        orderBy: {field: UPDATED_AT, direction: DESC},
        filterBy: {since: $since}
      ) {
        totalCount
        nodes {
          number
          updatedAt
          state
          isDraft
          title
          author {
            login
          }
        }
      }
    }
    
    rateLimit {
      limit
      cost
      remaining
      resetAt
    }
  }
`;

// Query for PR reviews only
export const GET_PR_REVIEWS = `
  query GetPRReviews($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        id
        databaseId
        number
        
        reviews(first: 100) {
          totalCount
          nodes {
            id
            databaseId
            state
            body
            submittedAt
            author {
              login
              avatarUrl
              ... on User {
                id: databaseId
                type: __typename
              }
            }
            commit {
              oid
            }
          }
        }
      }
    }
    
    rateLimit {
      limit
      cost
      remaining
      resetAt
    }
  }
`;

// Query for PR comments only
export const GET_PR_COMMENTS = `
  query GetPRComments($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        id
        databaseId
        number
        
        # Issue comments
        comments(first: 100) {
          totalCount
          nodes {
            id
            databaseId
            body
            createdAt
            updatedAt
            author {
              login
              avatarUrl
              ... on User {
                id: databaseId
                type: __typename
              }
            }
          }
        }
        
        # Review comments
        reviewComments(first: 100) {
          totalCount
          nodes {
            id
            databaseId
            body
            createdAt
            updatedAt
            position
            originalPosition
            diffHunk
            path
            author {
              login
              avatarUrl
              ... on User {
                id: databaseId
                type: __typename
              }
            }
            inReplyTo {
              id
              databaseId
            }
            pullRequestReview {
              id
              databaseId
            }
          }
        }
      }
    }
    
    rateLimit {
      limit
      cost
      remaining
      resetAt
    }
  }
`;

// Helper function to build dynamic batch queries
export function buildBatchPRQuery(prNumbers) {
  const aliases = prNumbers
    .map((number, index) => `pr${index}: pullRequest(number: ${number}) { ...PRBasicFragment }`)
    .join('\n        ');

  return `
    query GetBatchPRs($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        ${aliases}
      }
      
      rateLimit {
        limit
        cost
        remaining
        resetAt
      }
    }
    
    fragment PRBasicFragment on PullRequest {
      id
      databaseId
      number
      title
      state
      isDraft
      createdAt
      updatedAt
      closedAt
      mergedAt
      merged
      additions
      deletions
      changedFiles
      
      author {
        login
        avatarUrl
        ... on User {
          id: databaseId
        }
      }
      
      mergedBy {
        login
        avatarUrl
        ... on User {
          id: databaseId
        }
      }
      
      baseRefName
      headRefName
    }
  `;
}
