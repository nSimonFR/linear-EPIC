import { Issue, LinearClient } from "@linear/sdk";

import findState from "./find-state";
import { myIssue, myIssueQuery } from "./query";

const hasLabel = async (issue: Issue, labelToCheck: string) => {
  const labels = await issue.labels(); // TODO
  return labels.nodes.some((l) => l.name === labelToCheck);
};

export const updateParentState = (linearClient: LinearClient) => async (
  issueId: string,
  labelToCheck: string,
  allowManualUpdates = false
) => {
  let issue = await linearClient.issue(issueId); // TODO Remove

  if (!issue.parent) {
    if (allowManualUpdates) {
      return console.debug(`Stopping - Allowing manual EPIC updates.`);
    }

    if (!await hasLabel(issue, labelToCheck)) {
      return console.debug(`Stopping - issue not a ${labelToCheck}.`);
    }

    if (issue.estimate !== 0) {
      await linearClient.updateIssue(issueId, { estimate: 0 });
    }
  } else {
    issue = await issue.parent;

    if (!await hasLabel(issue, labelToCheck)) {
      return console.debug(`Stopping - parent not a ${labelToCheck}.`);
    }
  }

  console.info(`Found ${labelToCheck}: "${issue.title}".`);
  const result = await linearClient.client.rawRequest(myIssueQuery, { issueId: issue.id });
  const myIssue = (result.data as { issue: myIssue }).issue;

  const parentTeam = myIssue.team;
  const statesResult = await linearClient.workflowStates({
    filter: { team: { id: { eq: parentTeam!.id } } },
  });
  const states = statesResult.nodes;

  const childrens = myIssue.children;
  const state = findState(myIssue, childrens.nodes, states);
  if (!state) {
    return console.log(`[State] Stopping - No state.`);
  }

  if (state.id === myIssue.state!.id) {
    return console.log(`No need to update - matching state ${state.name}.`);
  }
  console.info(`Updating ${labelToCheck} to state: ${state.name}.`);

  await linearClient.updateIssue(myIssue.id, { stateId: state.id });
};