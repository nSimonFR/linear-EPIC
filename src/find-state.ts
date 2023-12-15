import { Issue, WorkflowState } from "@linear/sdk";

const STATE_TYPES_ORDERED = [
  "started",
  "unstarted",
  "backlog",
  "triage",
  "completed",
  "canceled",
];

const findState = async (issue: Issue, childrens: Issue[], states: WorkflowState[]) => {
  let state: WorkflowState | undefined = undefined;
  for (const children of childrens) {
    const childrenState = await children.state!;

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

  if (!state) return null;

  const stateTeam = await state.team!;
  const issueTeam = await issue.team!;
  if (stateTeam.id === issueTeam.id) return state;

  const matchingState = states.find((s) => s.name === state!.name);
  if (matchingState) return matchingState;

  state = undefined;

  const issueAndTeamsChildren = await Promise.all(childrens.map(async (issue) => {
    const team = await issue.team!;
    return { issue, team };
  }));

  const childrensForTeamFiltered = issueAndTeamsChildren
    .filter(({ team }) => team.id === issueTeam.id)
    .map(({ issue }) => issue);

  for (const children of childrensForTeamFiltered) {
    const childrenState = await children.state!;

    if (!state || childrenState.position < state.position) {
      state = childrenState;
    }
  }

  return state;
};

export default findState;