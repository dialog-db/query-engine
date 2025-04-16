# @dialog-db/query

[Datalog] query engine for the dialog database.

## Example

```js
import { deduce, Fact } from "@dialog-db/query"

export const demo = async (db) => {
  // We will be trying to find movie titles and director names for movies
  // where Arnold Schwarzenegger casted. We do not need a database schema
  // for writes but we do need schema for queries meaning we want to define
  // relations between entities and attributes.

  // We well be looking for actors and directors that are entities with
  // "person/name" attribute.
  const Person = deduce({
    this: Object,
    name: String
  }).where(({ name, this: person }) => [
    Person({ the: 'person/name', of: person, is: name })
  ])

  // We also define `Moive` entity with attributes for the director, cast
  // and a title.
  const Movie = deduce({
    this: Object,
    title: String,
    director: Object,
    cast: Object
  }).where(({ this: movie, title, director, cast }) => [
      Fact({ the: 'movie/title', of: movie, is: title }),
      Fact({ the: 'movie/director', of: movie, is: director }),
      Fact({ the: 'movie/cast', of: movie, is: cast })
    ])
  
  // We want find movie titles and their directors that
  const Query = deduce({ director: String, movie: String })
    .with({ $director: Object, $actor: Object })
    .where(({ movie, director, actor, $movie, $director, $actor }) => [
      Movie.match({ title: movie, director: $director, cast: $.actor }),
      Person({ this: $director, name: director }),
      Porson({ this: $actor, name: 'Arnold Schwarzenegger' })
    ])

  
  const movies = await Query().select({ from: db })
  // [
  //   { director: 'James Cameron', movie: 'The Terminator' },
  //   { director: 'John McTiernan', movie: 'Predator' },
  //   { director: 'Mark L. Lester', movie: 'Commando' },
  //   { director: 'James Cameron', movie: 'Terminator 2: Judgment Day' },
  //   {
  //     director: 'Jonathan Mostow',
  //     movie: 'Terminator 3: Rise of the Machines',
  //   },
  // ]
}
```

[datalog]: https://en.wikipedia.org/wiki/Datalog
