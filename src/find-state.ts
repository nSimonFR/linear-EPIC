import { WorkflowState } from "@linear/sdk";
import { myIssue, myState, mySubIssue } from "./query";

const STATE_TYPES_ORDERED = [
  "started",
  "unstarted",
  "backlog",
  "triage",
  "completed",
  "canceled",
];

const optimalStateForList = (childrens: mySubIssue[]) => {
  let state: myState | undefined = undefined;
  for (const children of childrens) {
    const childrenState = children.state;

    // Initial iteration for setup
    if (!state) {
      state = childrenState;
      continue;
    }

    const indexOfChildren = STATE_TYPES_ORDERED.indexOf(childrenState.type);
    const indexOfState = STATE_TYPES_ORDERED.indexOf(state.type);
    if (
      indexOfChildren < indexOfState ||
      (indexOfChildren === indexOfState &&
        childrenState.position < state.position)
    ) {
      state = childrenState;
    }
  }
  return state;
};

const findState = (
  issue: myIssue,
  childrens: mySubIssue[],
  states: WorkflowState[],
) => {
  const state: myState | undefined = optimalStateForList(childrens);

  if (!state) return null;

  const stateTeam = state.team!;
  const issueTeam = issue.team!;
  if (stateTeam.id === issueTeam.id) return state;

  const matchingState = states.find((s) => s.name === state!.name);
  if (matchingState) return matchingState;

  const issueAndTeamsChildren = childrens.map((issue) => {
    const team = issue.team!;
    return { issue, team };
  });

  const childrensForTeamFiltered = issueAndTeamsChildren
    .filter(({ team }) => team.id === issueTeam.id)
    .map(({ issue }) => issue);

  const fallbackState = optimalStateForList(childrensForTeamFiltered);

  return fallbackState;
};

export default findState;
