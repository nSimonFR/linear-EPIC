import { Issue, IssueLabel, Team, WorkflowState } from "@linear/sdk";

/* TODO: Generate query and types altogether */

export const myIssueQuery = `query Issues($issueId: String!) {
  issue(id: $issueId) {
    id,
    title,
    team {
      id,
      name
    },
    state {
      id,
      name,
      position,
      type,
      team {
        id
      }
    },
    labels {
      nodes {
        name
      }
    },
    children {
      nodes {
        id,
        team {
          id,
          name
        },
        state {
          id,
          name,
          position,
          type,
          team {
            id
          }
        }
      }
    }
  }
}`;

export type myState = {
  id: WorkflowState["id"],
  name: WorkflowState["name"],
  position: WorkflowState["position"],
  type: WorkflowState["type"],
  team: {
    id: Team["id"]
  }
}

export type mySubIssue = {
  id: Issue["id"],
  team: {
    id: Team["id"],
    name: Team["name"]
  },
  state: myState
}

export type myIssue = {
  id: Issue["id"],
  title: Issue["title"],
  team: {
    id: Team["id"],
    name: Team["name"],
  },
  state: myState,
  labels: {
    nodes: {
      name: IssueLabel["name"]
    }[]
  },
  children: {
    nodes: mySubIssue[]
  }
}