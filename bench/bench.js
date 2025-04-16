import { deduce, match } from '../src/lib.js'
import * as Archive from './archive.js'
import { assertEquals } from 'jsr:@std/assert'

const imdb = await Archive.open({
  json: new URL('./imdb.top1k.json', import.meta.url),
})

const moviesWithArnold = async () => {
  const Movie = deduce({
    movie: Object,
    title: String,
    actor: Object,
  }).where(({ movie, title, actor }) => [
    match({ the: 'movie/title', of: movie, is: title }),
    match({ the: 'movie/cast', of: movie, is: actor }),
    match({ the: 'actor/name', of: actor, is: 'Arnold Schwarzenegger' }),
  ])

  const result = await await Movie().query({ from: imdb })

  assertEquals(result.length, 3)
}

Deno.bench('Run query with a join', moviesWithArnold)
