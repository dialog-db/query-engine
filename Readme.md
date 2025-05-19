# @dialog-db/query

[Datalog] query engine for the dialog database.

## Example

```js
import { fact } from "@dialog-db/query"

export const demo = async (db) => {
  // We will be trying to find movie titles and director names for movies
  // where Arnold Schwarzenegger casted. We do not need a database schema
  // for writes but we do need schema for queries meaning we want to define
  // relations between entities and attributes.

  // We well be looking for actors and directors that are entities with
  // "person/name" attribute.
  const Person = fact({
    the: 'person',
    name: String
  })

  // We also define `Moive` entity with attributes for the director, cast
  // and a title.
  const Movie = fact({
    the: 'movie',
    title: String,
    director: Object,
    cast: Object
  })

  const Query = fact({
    title: String,
    director: String,
    actor: String,
  })
    .with({ cast: Object, directedBy: Object })
    .where(({ title, cast, directedBy, director, actor }) => [
      Movie({ cast, director: directedBy, title }),
      Person({ this: directedBy, name: director }),
      Person({ this: cast, name: actor }),
      Cast.claim({ title, actor, director }),
    ])


  await Query.match({ actor: 'Arnold Schwarzenegger' }).query({ from: db })
  // [
  //   {
  //      title: 'The Terminator',
  //      director: 'James Cameron',
  //      actor: 'Arnold Schwarzenegger'
  //   },
  //   {
  //      title: 'Predator',
  //      director: 'John McTiernan',
  //      actor: 'Arnold Schwarzenegger'
  //   },
  //   {
  //      title: 'Commando',
  //      director: 'Mark L. Lester',
  //      actor: 'Arnold Schwarzenegger'
  //   },
  //   {
  //      title: 'Terminator 2: Judgment Day',
  //      director: 'James Cameron',
  //      actor: 'Arnold Schwarzenegger'
  //   },
  //   {
  //     title: 'Terminator 3: Rise of the Machines',
  //     director: 'Jonathan Mostow',
  //     actor: 'Arnold Schwarzenegger'
  //   },
  // ]
}
```

## Setup

After cloning this repository, run the setup script to configure the Git remotes:

```bash
. ./scripts/setup.sh
```

Prerequisites:

- You must have the [Radicle CLI](https://radicle.xyz/download) installed (`rad` command)

This script will:

1. ✅ Check if the `rad` command is available
2. 👾 Set up Git aliases for with radicle patches.
3. ⛓️ Configure Git remotes for CI jobs.

[datalog]: https://en.wikipedia.org/wiki/Datalog
