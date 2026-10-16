# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the "Label in our tracker" column to match whatever vocabulary you actually use.

## How these meet the factory

- `ready-for-agent` means vetted and fully specified. Nothing builds it automatically: the owner adds the `factory` label to start a factory run. Skills must never add `factory` themselves.
- `ready-for-human` is a triage outcome (a human should build it). It's unrelated to `needs-human`, which the factory adds when a run stops and needs the owner.
- New suggestions from the issue template arrive with `needs-triage` already applied.
