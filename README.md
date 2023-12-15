# Linear - Agile EPIC

Extends [linear.app](linear.app) with Agile EPIC functionality !

TLDR; auto-sync of state of issues to parent !

# Context

Back when my team used [ZenHub](https://www.zenhub.com/) - we had the notion of EPICs as containers of tickets.

This was very useful when we had to iterate over multiple repositories for a project, as we could have a parent structure like this:

- EPIC "Project XXX"
  - Sub-issue 1 => Do stuff on API
  - Sub-issue 2 => Do stuff on MicroService
  - Sub-issue 3 => Do stuff on WebApp

Allowing us to work collaboratively and split tasks and track each actions individually with a container to see the project progress as a whole.

Having switched to [linear](http://linear.app/), we still required something along the lines of the notion of EPIC, and this newly introduced tool gives the ability to create parent and sub issues by also relying on states to track progress in boards/projets.

# Installation

TODO

# What does it do ?

You just need to update your parent ticket to put the tag `EPIC` to it.

Once you do, it will:

- Update the estimation to 0 (That way you know it's connected)

!! Estimation in linear is tracked as a total so putting it to zero will mean it will still count the total estimation for every sub-tickets.

- Start tracking every sub tickets state changes, and reflect the "lowest state" on to the EPIC

It is then advised to use this every time you mean to use a parent / children relation.

!! It is also advised to split tickets as much as possible and use parent as EPIC every time you have different actions to undertake (Ex: 2 Github PR for a subject => 2 linear tickets with a parent EPIC).

You can even put an EPIC in a EPIC (Such was the way in Zenhub) !

## Automation explanation

Each ticket has a `WorkflowState` which represents its progress (Ex: `Backlog` / `QA Ready` ), and each of these states have a `type` (They `started` / `completed` and a priority).

**The rule is as follows:**

<mark>For every child ticket, take the lowest statetype / statename and make it the parent state.</mark>

<mark></mark>

It also works cross-team if they label states the same name or else will default to just statetype management.

Statetype list and priorities is as follows:

```typescript
(started) => (unstarted) => (backlog) => (triage) => (completed) => canceled;
```

## Technical Example 1

States:

- In Progress => `type=started` / `position=10`
- Review => `type=started` / `position=20`

Tickets:

Parent with `EPIC` label and `Review` state

1.  Child => In Progress
2.  Child => Review

=> Parent will go to `In Progress` state (Lower of the two)

## Technical Example 2

States:

- Completed => `type=completed` / `position=1`
- In Progress => `type=started` / `position=10`
- Review => `type=started` / `position=20`

Tickets:

Parent with `EPIC` label and `Review` state

1.  Child => `In Progress`
2.  Child => `Production`

=> Parent will go to `In Progress` state (Lower position for `completed` but higher statetype).

## Test states

[Here you can find more examples of tests for states !](./src/find-state.test.ts)
