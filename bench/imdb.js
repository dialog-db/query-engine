import parseCSV from 'https://esm.sh/neat-csv'
import { refer } from 'https://esm.sh/merkle-reference'
import { Memory, API } from '../src/lib.js'

/**
 * Opens a database from the given CSV file location.
 *
 * @param {{csv: URL}} address
 */
export const open = async ({ csv: url }) => {
  const response = await fetch(url)
  const data = await parseCSV(await response.text())

  /** @type {API.Fact[]} */
  const facts = []
  const directors = new Map()
  const actors = new Map()

  for (const row of data) {
    const {
      Series_Title: title,
      Released_Year: year,
      Certificate: certificate,
      Runtime: runtime,
      Genre: genre,
      IMDB_Rating: rating,
      Director: directorName,
      Star1: cast1,
      Star2: cast2,
      Star3: cast3,
      Star4: cast4,
    } = row

    const movie = refer({ title, release: year })

    facts.push(
      [movie, 'movie/title', title],
      [movie, 'movie/year', row.Released_Year]
    )

    if (certificate) {
      facts.push([movie, 'movie/certificate', certificate])
    }

    if (runtime) {
      facts.push([movie, 'movie/runtime', row.Runtime])
    }

    for (const member of genre.split(',').filter(Boolean)) {
      facts.push([movie, 'movie/genre', member.trim()])
    }

    if (rating) {
      facts.push([movie, 'imdb/rating', Number(rating)])
    }

    const director = directors.get(directorName)
    if (director) {
      facts.push([movie, 'movie/director', director])
    } else {
      const director = refer({ Director: { name: directorName } })
      directors.set(directorName, director)
      facts.push([movie, 'movie/director', director])
      facts.push([director, 'director/name', directorName])
    }

    for (const cast of [cast1, cast2, cast3, cast4].filter(Boolean)) {
      const actor = actors.get(cast)
      if (actor) {
        facts.push([movie, 'movie/cast', actor])
      } else {
        const actor = refer({ Actor: { name: cast } })
        actors.set(cast, actor)
        facts.push([movie, 'movie/cast', actor])
        facts.push([actor, 'actor/name', cast])
      }
    }
  }

  return Memory.create(facts)
}

/**
 * Export given CSV file in a DB JSON dump.
 */
export const exportJSON = async ({ csv: url }) => {
  const response = await fetch(url)
  const data = await parseCSV(await response.text())

  const output = {}

  const directors = new Map()
  const actors = new Map()

  for (const row of data) {
    const {
      Series_Title: title,
      Released_Year: year,
      Certificate: certificate,
      Runtime: runtime,
      Genre: genre,
      IMDB_Rating: rating,
      Director: directorName,
      Star1: cast1,
      Star2: cast2,
      Star3: cast3,
      Star4: cast4,
    } = row

    const instance = {}
    output[refer({ title, release: year })] = instance

    const movie = {}
    instance['movie'] = movie

    movie.title = title
    movie.year = row.Released_Year

    if (certificate) {
      movie.certificate = certificate
    }

    if (runtime) {
      movie.runtime = runtime
    }

    const moveGenre = []
    movie.genre = moveGenre
    for (const member of genre.split(',').filter(Boolean)) {
      moveGenre.push(member.trim())
    }

    if (rating) {
      const imdb = {}
      instance['imdb'] = imdb
      imdb.rating = Number(rating)
    }

    const director = directors.get(directorName)
    if (director) {
      movie.director = director
    } else {
      const director = refer({ Director: { name: directorName } })
      directors.set(directorName, director)
      movie.director = director

      output[director] = {
        director: {
          name: directorName,
        },
      }
    }

    const movieCast = []
    movie.cast = movieCast
    for (const cast of [cast1, cast2, cast3, cast4].filter(Boolean)) {
      const actor = actors.get(cast)
      if (actor) {
        movieCast.push(actor)
      } else {
        const actor = refer({ Actor: { name: cast } })
        actors.set(cast, actor)
        movieCast.push(actor)

        output[actor] = {
          actor: {
            name: cast,
          },
        }
      }
    }
  }

  return output
}
