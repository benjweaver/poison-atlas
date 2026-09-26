import { nextTick } from 'vue'

import { useUrlState } from './url-state'

afterEach(() => history.replaceState(null, '', '/'))

describe('url state: minimum danger', () => {
  it('reads ?d= and ignores anything out of range', () => {
    history.replaceState(null, '', '/?d=4')
    expect(useUrlState().minDanger).toBe(4)
    history.replaceState(null, '', '/?d=9')
    expect(useUrlState().minDanger).toBe(1)
    history.replaceState(null, '', '/?d=snake')
    expect(useUrlState().minDanger).toBe(1)
  })

  it('writes it to the URL, and leaves it out when everything is shown', async () => {
    history.replaceState(null, '', '/?r=AU')
    const state = useUrlState()
    state.minDanger = 3
    await nextTick()
    expect(location.search).toBe('?r=AU&d=3')
    state.minDanger = 1
    await nextTick()
    expect(location.search).toBe('?r=AU')
  })
})
