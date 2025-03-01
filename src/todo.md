# Todo

## Analyzer

- Error in when variables are not connected to the scope variables in any way e.g in the example below `$.name` is not exposed by rule nor is it is used in any join.

  ```js
  const rule = {
    match: { x: $.x },
    when: [{
      match: {
        the: 'name',
        of: $.x,
        is: $.name
      }
    }]
  }
  ```

  On the other hand is is fine because internal variable is used to join on and in fact you could reference `$.name` as `['.x', 'name']`

  ```js
  const rule = {
    match: { x: $.x },
    when: [{
      match: {
        the: 'name',
        of: $.x,
        is: $.name
      },
      {
        match: {
          of: $.name,
          is: "string"
        },
        operator: "data/type"
      }
    }]
  }
  ```

  It works for reverse lookups also work and `$.subject` could be referred as `{title: '.name'}` and `$.date` could be referred as `[{title: '.name'}, 'assert/date']`

  ```js
  const rule = {
    match: { name: $.name, date: $.date },
    when: [{
      match: {
        the: 'title',
        of: $.subject,
        is: $.name
      },
      {
        the: 'assert/data',
        of: $.subject,
        is: $.date
      }
      {
        match: {
          this: $.data,
          than: $.date
        },
        operator: "<"
      }
    }]
  }
  ```
