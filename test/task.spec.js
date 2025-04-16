import { Task } from './lib.js'

/**
 * @type {import('entail').Suite}
 */
export const testTask = {
  'test sync': (assert) =>
    Task.spawn(function* () {
      /**
       * @template T
       * @param {T} x
       */
      function* ok(x) {
        return x
      }

      const invocation = Task.perform(ok(4))
      const output = yield* invocation
      assert.equal(output, 4)
    }),
  'task sleep can be aborted': async (assert) => {
    const task = Task.perform(Task.sleep(10))

    task.abort('cancel')

    const result = await task.result()
    assert.deepEqual(result.error?.reason, 'cancel')
    assert.deepEqual(result.error?.name, 'AbortError')
  },

  'sleep awake': async (assert) => {
    const task = Task.perform(Task.sleep(10))
    const result = await task.result()
    assert.deepEqual(result, { ok: undefined })
  },

  'task cancels joined task': async (assert) => {
    let done = false
    function* worker() {
      yield* Task.sleep(10)
      done = true
    }

    function* main() {
      return yield* Task.spawn(worker)
    }

    const task = Task.perform(main())
    task.abort('cancel')
    const result = await task.result()
    assert.deepEqual(result.error?.reason, 'cancel')

    await new Promise((resolve) => setTimeout(resolve, 20))

    assert.deepEqual(done, false)
  },

  'test wait': async (assert) => {
    const task = Task.spawn(function* () {
      const value = yield* Task.wait(Promise.resolve(4))
      return value
    })

    assert.deepEqual(await task.result(), { ok: 4 })
  },
}

/**
 * @type {import('entail').Suite}
 */
export const testRecursiveTask = {
  'recursive task loses suspension state': async (assert) => {
    let resumeCount = 0
    let suspendCount = 0

    /**
     * @param {number} depth
     * @returns {Task.Task<number>}
     */
    function* recursiveTask(depth) {
      if (depth <= 0) return depth

      // Create child task
      const child = recursiveTask(depth - 1)

      // This suspension should be tracked
      suspendCount++
      yield Task.SUSPEND

      // Execute child task
      const result = yield* child

      // This suspension may be lost or mishandled
      suspendCount++
      yield Task.SUSPEND

      resumeCount++
      return result + 1
    }

    const task = Task.perform(recursiveTask(3))

    // Resume multiple times to ensure all suspensions are handled
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1))
      task.wake?.()
    }

    const result = await task.result()

    // The test should fail because suspensions are lost
    // In a correct implementation, for depth 3:
    // - Each level should suspend twice (before and after child execution)
    // - Total suspensions should be 6 (2 * 3)
    // - Total resumes should be 3 (one per level)
    assert.equal(
      suspendCount,
      6,
      'Expected 6 suspensions (2 per level for depth 3)'
    )
    assert.equal(resumeCount, 3, 'Expected 3 resumes (one per level)')
    assert.deepEqual(result, { ok: 3 }, 'Expected final result to be 3')
  },
  'skip recursive task with wake groups loses sync': async (assert) => {
    const wakeGroups = new Set()
    let activeGroups = 0

    /**
     *
     * @param {number} depth
     * @returns {Task.Task<number>}
     */
    function* recursiveTaskWithGroups(depth) {
      if (depth <= 0) return depth

      // Create a wake group for this level
      const group = {
        wake: () => {
          activeGroups--
        },
      }
      wakeGroups.add(group)
      activeGroups++

      // Join the wake group
      yield { join: group }

      // Create and execute child task
      const child = recursiveTaskWithGroups(depth - 1)
      const result = yield* child

      yield Task.SUSPEND

      return result + 1
    }

    const task = Task.perform(recursiveTaskWithGroups(3))
    task.abort('cancel')

    const result = await task.result()

    // The test should fail because wake groups aren't properly managed
    // In a correct implementation:
    // - All wake groups should be triggered on abort
    // - activeGroups should be 0 after all groups are woken
    assert.equal(activeGroups, 0, 'Expected all wake groups to be triggered')
    assert.deepEqual(result.error?.reason, 'cancel')
  },

  'skip recursive task with error propagation': async (assert) => {
    let errorDepth = null

    /**
     *
     * @param {number} depth
     * @returns {Task.Task<number>}
     */
    function* recursiveTaskWithError(depth) {
      if (depth <= 0) throw new Error(`Error at depth ${depth}`)

      try {
        // Create and execute child task
        const child = recursiveTaskWithError(depth - 1)
        yield Task.SUSPEND

        const result = yield* child
        return result + 1
      } catch (error) {
        errorDepth = depth
        throw error // Re-throw to propagate
      }
    }

    const task = Task.perform(recursiveTaskWithError(3))

    console.log('!')
    const result = await task.result()
    console.log('!!', result)

    // The test should fail because error propagation is broken
    // We expect the error to bubble up through all levels
    // and errorDepth should be 3 (caught at the top level)
    assert.equal(errorDepth, 3, 'Error should propagate to top level')
    assert.ok(result.error instanceof Error, 'Should receive error result')
  },

  'nested tasks may deadlock on abort': async (assert) => {
    let innerCompleted = false
    let outerCompleted = false

    function* innerTask() {
      yield* Task.sleep(10)
      innerCompleted = true
    }

    function* outerTask() {
      const inner = Task.spawn(innerTask)
      yield* inner
      outerCompleted = true
    }

    const task = Task.perform(outerTask())
    task.abort('cancel')

    const result = await task.result()
    assert.deepEqual(result.error?.reason, 'cancel')

    // Wait to ensure tasks had time to complete
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Test should fail as inner task may continue running
    assert.equal(innerCompleted, false, 'Inner task should be aborted')
    assert.equal(outerCompleted, false, 'Outer task should be aborted')
  },

  'recursive task with promises may lose coordination': async (assert) => {
    /** @type {number[]} */
    let completionOrder = []

    /**
     *
     * @param {number} depth
     * @returns {Task.Task<number>}
     */
    function* recursiveWait(depth) {
      if (depth <= 0) {
        completionOrder.push(depth)
        return depth
      }

      // Create a promise and wait for it
      const promise = new Promise((resolve) =>
        setTimeout(() => resolve(depth), 10)
      )
      const value = yield* Task.wait(promise)

      // Recursively wait on child task
      const child = recursiveWait(depth - 1)
      const result = yield* child

      completionOrder.push(value)
      return result + 1
    }

    const task = Task.perform(recursiveWait(3))
    const result = await task.result()

    // Test should fail because promise coordination is lost
    assert.deepEqual(result, { ok: 3 }, 'Should complete with correct value')
    assert.deepEqual(
      completionOrder,
      [0, 1, 2, 3],
      'Tasks should complete in order'
    )
  },

  'nested sleeps with abort may leak': async (assert) => {
    let taskCount = 0

    function* nestedSleep() {
      taskCount++
      try {
        yield* Task.sleep(10)
        // Start another sleep while parent might be aborting
        yield* Task.sleep(10)
      } finally {
        taskCount--
      }
    }

    function* parentTask() {
      const child = Task.spawn(nestedSleep)
      yield* child
    }

    const task = Task.perform(parentTask())

    // Give task time to start
    await new Promise((resolve) => setTimeout(resolve, 5))
    task.abort('cancel')

    const result = await task.result()
    assert.deepEqual(result.error?.reason, 'cancel')

    // Wait to ensure all tasks had time to complete
    await new Promise((resolve) => setTimeout(resolve, 30))

    // Test should fail as some tasks may not clean up properly
    assert.equal(taskCount, 0, 'All tasks should be cleaned up')
  },

  'recursive task after iterator pattern': async (assert) => {
    function createIterator() {
      let count = 0
      return {
        /**
         * @returns {Task.Task<Task.Result<number, Error>, Error>}
         */
        *next() {
          if (count < 2) {
            count++
            yield* Task.sleep(1)
            return { ok: count }
          } else {
            return { error: new Error('done') }
          }
        },
      }
    }

    /**
     * @param {number} depth
     * @returns {Task.Task<{}, Error>}
     */
    function* traverse(depth) {
      if (depth >= 3) {
        return {}
      }

      const iterator = createIterator()
      while (true) {
        const result = yield* iterator.next()
        if ('error' in result) {
          break
        } else {
          yield* traverse(depth + 1)
        }
      }
      return {}
    }

    const task = Task.perform(traverse(0))
    const result = await task.result()
    assert.ok(result.ok, 'Should complete successfully')
  },

  'recursive task with state corruption': async (assert) => {
    /** @type {Map<string, number>} */
    const store = new Map()
    let opsCount = 0

    /**
     * @param {string} key
     * @returns {Task.Task<Task.Result<number|null, Error>, Error>}
     */
    function* read(key) {
      yield* Task.sleep(1) // Simulate IDB
      opsCount++
      return { ok: store.get(key) ?? null }
    }

    /**
     * @param {string} key
     * @param {number} value
     * @returns {Task.Task<{}, Error>}
     */
    function* write(key, value) {
      yield* Task.sleep(1) // Simulate IDB
      opsCount++
      store.set(key, value)
      return {}
    }

    /**
     * @param {string} key
     * @returns {Task.Task<{}, Error>}
     */
    function* del(key) {
      yield* Task.sleep(1) // Simulate IDB
      opsCount++
      store.delete(key)
      return {}
    }

    /**
     * Simulates updating a tree node and its parents
     * @param {string} key
     * @returns {Task.Task<{}, Error>}
     */
    function* updateNode(key) {
      const result = yield* read(key)

      if ('error' in result) return {}

      if (result.ok === null) {
        // Create new node
        yield* write(key, 1)
        // Update parent
        if (key !== 'root') {
          yield* updateNode('root')
        }
      } else {
        // Update existing node
        yield* write(key, result.ok + 1)
        // Clean up old references
        yield* cleanupReferences(key)
      }

      return {}
    }

    /**
     * Simulates cleaning up old references
     * @param {string} key
     * @returns {Task.Task<{}, Error>}
     */
    function* cleanupReferences(key) {
      const refs = [`${key}-ref1`, `${key}-ref2`]
      for (const ref of refs) {
        const result = yield* read(ref)
        if ('ok' in result && result.ok !== null) {
          yield* del(ref)
          yield* cleanupReferences(ref)
        }
      }
      return {}
    }

    // Setup initial state
    await Task.perform(write('root-ref1', 1))
    await Task.perform(write('root-ref1-ref1', 1))

    // Perform multiple updates
    const results = await Promise.all([
      Task.perform(updateNode('root')).result(),
      Task.perform(updateNode('root-ref1')).result(),
      Task.perform(updateNode('root-ref2')).result(),
    ])

    assert.ok(
      results.every((r) => 'ok' in r),
      'All operations should succeed'
    )
    assert.equal(store.get('root'), 2, 'Root should be updated correctly')
    assert.equal(
      store.has('root-ref1'),
      false,
      'Old reference should be cleaned up'
    )
    assert.equal(
      store.has('root-ref1-ref1'),
      false,
      'Nested reference should be cleaned up'
    )
  },

  'skip recursive task with depth-dependent state corruption': async (
    assert
  ) => {
    /** @type {Map<string, number>} */
    const store = new Map()
    let maxLevel = 0

    /**
     * @returns {Task.Task<Task.Result<number, Error>, Error>}
     */
    function* getMaxLevel() {
      yield* Task.sleep(1)
      return { ok: maxLevel }
    }

    /**
     * @param {number} level
     * @returns {Task.Task<{}, Error>}
     */
    function* createLevel(level) {
      // Update max level if needed
      const result = yield* getMaxLevel()
      if (result.ok != null && level > result.ok) {
        maxLevel = level

        // Create parent levels first
        yield* createParentLevels(level)
      }
      return {}
    }

    /**
     * @param {number} level
     * @returns {Task.Task<{}, Error>}
     */
    function* createParentLevels(level) {
      if (level <= 0) return {}

      // Write current level
      yield* Task.sleep(1)
      store.set(`level-${level}`, level)

      // This recursive call might interact badly with state
      yield* createParentLevels(level - 1)

      // After recursion, verify/fix parent levels
      yield* cleanupOrphanedLevels(level)

      return {}
    }

    /**
     * @param {number} level
     * @returns {Task.Task<{}, Error>}
     */
    function* cleanupOrphanedLevels(level) {
      const result = yield* getMaxLevel()
      if (!('ok' in result)) return {}

      // This is where things might go wrong - checking and potentially
      // deleting levels after recursive creation
      if (result.ok != null && level > result.ok) {
        yield* Task.sleep(1)
        store.delete(`level-${level}`)
      }
      return {}
    }

    // Incrementally create levels and check state
    for (let i = 1; i <= 3; i++) {
      const task = Task.perform(createLevel(i))
      const result = await task.result()
      assert.ok('ok' in result, `Level ${i} creation should succeed`)

      // Verify each level exists
      for (let j = 0; j <= i; j++) {
        assert.ok(
          store.has(`level-${j}`),
          `Level ${j} should exist after creating level ${i}`
        )
      }
    }
  },

  'minimal recursive task test': async (assert) => {
    /** @type {Set<string>} */
    const store = new Set()

    /**
     * @param {number} level
     * @returns {Task.Task<{}, Error>}
     */
    function* create(level) {
      // Write current level
      yield* Task.sleep(1)
      store.add(`level-${level}`)

      // Check if we need parent
      if (level > 0) {
        yield* create(level - 1)
      }
      return {}
    }

    /**
     * @param {number} level
     * @returns {Task.Task<{}, Error>}
     */
    function* cleanup(level) {
      // Delete current level
      yield* Task.sleep(1)
      store.delete(`level-${level}`)

      // Recursively cleanup parent
      if (level > 0) {
        yield* cleanup(level - 1)
      }
      return {}
    }

    // Create level 2 (should create 2,1,0)
    const task = Task.perform(create(2))
    await task.result()

    // Cleanup level 1 (should cleanup 1,0)
    const cleanup1 = Task.perform(cleanup(1))
    await cleanup1.result()

    // Should still have level 2
    assert.ok(store.has('level-2'), 'Level 2 should still exist')
    assert.ok(!store.has('level-1'), 'Level 1 should be cleaned up')
    assert.ok(!store.has('level-0'), 'Level 0 should be cleaned up')
  },

  'recursive task with nested recursion': async (assert) => {
    /** @type {Set<string>} */
    const store = new Set()

    /**
     * @param {number} level
     * @returns {Task.Task<{}, Error>}
     */
    function* recursiveDelete(level) {
      const key = `level-${level}`
      yield* Task.sleep(1)
      store.delete(key)

      if (level > 0) {
        yield* recursiveDelete(level - 1)
      }
      return {}
    }

    /**
     * @param {number} level
     * @returns {Task.Task<{}, Error>}
     */
    function* recursiveUpdate(level) {
      const key = `level-${level}`
      yield* Task.sleep(1)
      store.add(key)

      // Similar to your updateAnchor pattern:
      // Check something, maybe recurse, then delete
      if (level > 0) {
        yield* recursiveUpdate(level - 1)
        // This deleteParents-like call might interact badly
        // with the outer recursion
        yield* recursiveDelete(level)
      }

      return {}
    }

    // Setup initial state
    store.add('level-2')
    store.add('level-1')
    store.add('level-0')

    // This should update and maintain correct state
    const task = Task.perform(recursiveUpdate(2))
    await task.result()

    // Check final state
    assert.ok(store.has('level-2'), 'Top level should exist')
    assert.ok(store.has('level-1'), 'Middle level should exist')
    assert.ok(store.has('level-0'), 'Bottom level should exist')
  },
}
