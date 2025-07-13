# Data Fetching System Diagram

## High-Level Architecture

```mermaid
graph TB
    subgraph "User Interface"
        UI[Repository View]
        Monitor[Health Monitor]
    end
    
    subgraph "Data Fetching Layer"
        Router[Smart Router]
        Classifier[Size Classifier]
        Strategy[Fetch Strategy]
    end
    
    subgraph "Queue System"
        HQM[Hybrid Queue Manager]
        Priority[Priority Service]
        Retry[Auto-Retry Service]
    end
    
    subgraph "Processors"
        Inngest[Inngest<br/>Real-time]
        GHA[GitHub Actions<br/>Bulk]
    end
    
    subgraph "Data Sources"
        Cache[(Supabase Cache)]
        GHAPI[GitHub API]
    end
    
    subgraph "Monitoring"
        Reporter[Status Reporter]
        Metrics[Metrics Service]
    end
    
    UI --> Router
    Router --> Classifier
    Classifier --> Strategy
    Strategy --> Cache
    Strategy --> HQM
    
    HQM --> Priority
    Priority --> Inngest
    Priority --> GHA
    
    Inngest --> GHAPI
    GHA --> GHAPI
    
    Inngest --> Cache
    GHA --> Cache
    
    HQM --> Retry
    Retry --> HQM
    
    Reporter --> Monitor
    Metrics --> Monitor
    
    Inngest --> Reporter
    GHA --> Reporter
```

## Data Flow Sequence

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant Router
    participant Cache
    participant Queue
    participant Processor
    participant GitHub
    
    User->>UI: Request Repository Data
    UI->>Router: getSupabasePRData()
    
    Router->>Router: Classify Repository Size
    Router->>Cache: Check Cached Data
    
    alt Has Recent Cache
        Cache-->>Router: Return Cached Data
        Router-->>UI: Immediate Response
    else No Cache
        Router->>GitHub: Fetch Limited Live Data
        GitHub-->>Router: Partial Data
        Router-->>UI: Immediate Response
        Router->>Queue: Queue Background Job
    end
    
    Queue->>Queue: Calculate Priority Score
    Queue->>Processor: Assign to Processor
    
    alt Inngest (Real-time)
        Processor->>GitHub: GraphQL Query
        GitHub-->>Processor: Bulk Data
    else GitHub Actions (Bulk)
        Processor->>GitHub: REST API Calls
        GitHub-->>Processor: Historical Data
    end
    
    Processor->>Cache: Store Results
    Processor->>UI: Update Display
```

## Repository Classification Logic

```mermaid
graph TD
    Start[Repository Data] --> Metrics{Gather Metrics}
    
    Metrics --> Stars[Stars Count]
    Metrics --> PRs[Monthly PRs]
    Metrics --> Forks[Fork Count]
    Metrics --> Contributors[Active Contributors]
    
    Stars --> Score[Calculate Score]
    PRs --> Score
    Forks --> Score
    Contributors --> Score
    
    Score --> Size{Determine Size}
    
    Size -->|Score < 100| Small[Small Repository]
    Size -->|100-500| Medium[Medium Repository]
    Size -->|500-2000| Large[Large Repository]
    Size -->|> 2000| XL[XL Repository]
    
    Small --> Strategy1[30 days, Immediate]
    Medium --> Strategy2[14 days, Immediate]
    Large --> Strategy3[7 days, Chunked]
    XL --> Strategy4[3 days, Rate Limited]
```

## Queue Priority Scoring

```mermaid
graph LR
    subgraph "Input Factors"
        Priority[Repository Priority<br/>High: 40pts<br/>Med: 20pts<br/>Low: 10pts]
        Size[Repository Size<br/>Small: 30pts<br/>Med: 20pts<br/>Large: 15pts<br/>XL: 10pts]
        Trigger[Trigger Source<br/>Manual: 20pts<br/>Auto: 10pts<br/>Scheduled: 5pts]
        Activity[Activity Level<br/>Very Active: 10pts<br/>Active: 5pts]
    end
    
    subgraph "Calculation"
        Priority --> Total[Total Score<br/>0-100 points]
        Size --> Total
        Trigger --> Total
        Activity --> Total
    end
    
    subgraph "Routing"
        Total --> Decision{Score + Size}
        Decision -->|Small/Medium +<br/>High Score| Inngest
        Decision -->|Large/XL +<br/>Any Score| GitHub
        Decision -->|Low Score +<br/>Scheduled| GitHub
    end
```

## Error Handling Flow

```mermaid
stateDiagram-v2
    [*] --> Pending: Job Created
    Pending --> Processing: Start Execution
    Processing --> Completed: Success
    Processing --> Failed: Error
    
    Failed --> RetryCheck: Check Retry Count
    RetryCheck --> Pending: Retry < 3
    RetryCheck --> PermanentFailure: Retry >= 3
    
    Failed --> PermanentFailure: Permanent Error
    
    PermanentFailure --> [*]
    Completed --> [*]
    
    note right of Failed
        Transient Errors:
        - Network timeout
        - Rate limit
        - Temp unavailable
    end note
    
    note right of PermanentFailure
        Permanent Errors:
        - Repo not found
        - Unauthorized
        - Invalid input
    end note
```

## Monitoring Dashboard Components

```mermaid
graph TD
    subgraph "Capture Health Monitor"
        Stats[Queue Statistics]
        Jobs[Recent Jobs List]
        Metrics[Performance Metrics]
    end
    
    subgraph "Queue Statistics"
        InngestQ[Inngest Queue<br/>- Pending<br/>- Processing<br/>- Completed<br/>- Failed]
        GitHubQ[GitHub Actions Queue<br/>- Pending<br/>- Processing<br/>- Completed<br/>- Failed]
        TotalQ[Total Overview<br/>- Combined Stats<br/>- Failure Rate]
    end
    
    subgraph "Job Details"
        JobType[Job Type]
        Status[Status + Progress]
        Duration[Processing Time]
        Processor[Assigned Processor]
    end
    
    Stats --> InngestQ
    Stats --> GitHubQ
    Stats --> TotalQ
    
    Jobs --> JobType
    Jobs --> Status
    Jobs --> Duration
    Jobs --> Processor
```