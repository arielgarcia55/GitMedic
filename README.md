# GitMedic

A web application that takes any public GitHub repository and produces a comprehensive analysis of its activity, health, and risk. Built with React on the frontend and a serverless AWS backend.

## What it does

Enter a GitHub repository URL and choose one of three analyses:

- **Commit Activity** — Visualizes commit patterns over the past 12 months as a heatmap, plots a rolling 30-day activity chart, and summarizes whether the repo is trending up, down, or stable.
- **Repo Health Score** — Computes a composite health grade using weighted signals including commit frequency, issue backlog age, PR turnaround time, and contributor diversity.
- **Risk Detection** — Scans for warning signs like bus factor concentration, contributor dropout, stale branches, and unreviewed PRs. Each risk is flagged with a severity level and explanation.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite, Recharts |
| API | AWS API Gateway |
| Compute | AWS Lambda (Python 3.12) |
| Cache | AWS DynamoDB |
| Data source | GitHub REST API |

## How it works

1. User enters a repo URL and selects an analysis type
2. The request hits API Gateway which routes it to the corresponding Lambda function
3. Lambda checks DynamoDB for a cached result — if found, returns it immediately
4. If no cache hit, Lambda fetches data from the GitHub API, runs the analysis, stores the result in DynamoDB, and returns it
5. Results are rendered in the React frontend with data visualizations

Cache TTL is 1 hour for commit activity and 24 hours for health score and risk detection.

## Project Structure

```
├── backend/
│   ├── commitActivity/
│   │   ├── lambda_function.py
│   │   └── github_utils.py
│   ├── healthScore/
│   │   ├── lambda_function.py
│   │   └── github_utils.py
│   └── riskDetection/
│       ├── lambda_function.py
│       └── github_utils.py
└── frontend/
    └── src/
        ├── App.jsx
        └── RepoAnalyzer.jsx
```
