import { Issue, LinearClient } from "@linear/sdk";
import findState from "./find-state";

const hasLabel = async (issue: Issue, labelToCheck: string) => {
  const labels = await issue.labels(); // TODO
  return labels.nodes.some((l) => l.name === labelToCheck);
};

export const updateParentState = (linearClient: LinearClient) => async (issueId: string, labelToCheck = "EPIC") => {
  const issue = await linearClient.issue(issueId);

  const parent = await issue.parent;
  if (!parent) {
    if (!hasLabel(issue, labelToCheck)) {
      return console.debug(`Stopping - No parent & not ${labelToCheck}`);
    }

    // TODO allow automatic update from issue

    await linearClient.updateIssue(issueId, { estimate: 0 });
  } else {
    if (!hasLabel(parent, labelToCheck)) {
      return console.debug(`Stopping - Parent not a ${labelToCheck}.`);
    }

    console.info(`Found ${labelToCheck}: ${parent.title}.`);

    const parentTeam = await parent.team;
    const statesResult = await linearClient.workflowStates({
      filter: { team: { id: { eq: parentTeam!.id } } },
    });
    const states = statesResult.nodes;

    const childrens = await parent.children();
    const state = await findState(parent, childrens.nodes, states);
    if (!state) {
      return console.log(`[State] Stopping - No state.`);
    }

    const parentState = await parent.state;
    if (state.id === parentState!.id) {
      return console.log(`No need to update - matching state ${state.name}.`);
    }
    console.info(`Updating ${labelToCheck} to state: ${state.name}.`);

    await linearClient.updateIssue(parent.id, { stateId: state.id });
  }
};