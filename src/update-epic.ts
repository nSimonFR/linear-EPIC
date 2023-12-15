import { Issue, LinearClient } from "@linear/sdk";
import findState from "./find-state";

const hasLabel = async (issue: Issue, labelToCheck: string) => {
  const labels = await issue.labels(); // TODO
  return labels.nodes.some((l) => l.name === labelToCheck);
};

export const updateParentState = (linearClient: LinearClient) => async (issueId: string, labelToCheck: string) => {
  let issue = await linearClient.issue(issueId);

  if (!issue.parent) {
    await linearClient.updateIssue(issueId, { estimate: 0 });
  } else {
    issue = await issue.parent;
  }

  if (!hasLabel(issue, labelToCheck)) {
    return console.debug(`Stopping - Issue not a ${labelToCheck}.`);
  }

  console.info(`Found ${labelToCheck}: ${issue.title}.`);

  const parentTeam = await issue.team;
  const statesResult = await linearClient.workflowStates({
    filter: { team: { id: { eq: parentTeam!.id } } },
  });
  const states = statesResult.nodes;

  const childrens = await issue.children();
  const state = await findState(issue, childrens.nodes, states);
  if (!state) {
    return console.log(`[State] Stopping - No state.`);
  }

  const parentState = await issue.state;
  if (state.id === parentState!.id) {
    return console.log(`No need to update - matching state ${state.name}.`);
  }
  console.info(`Updating ${labelToCheck} to state: ${state.name}.`);

  await linearClient.updateIssue(issue.id, { stateId: state.id });
};