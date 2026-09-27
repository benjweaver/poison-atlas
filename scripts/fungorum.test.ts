import { currentName, parseRecords } from './fungorum.ts'

// Trimmed from a real NameSearch reply for "Amanita phalloides".
const reply = `<?xml version="1.0" encoding="utf-8"?>
<NewDataSet>
  <IndexFungorum>
    <NAME_x0020_OF_x0020_FUNGUS>Amanita phalloides</NAME_x0020_OF_x0020_FUNGUS>
    <AUTHORS>Secr.</AUTHORS>
    <INFRASPECIFIC_x0020_RANK>sp.</INFRASPECIFIC_x0020_RANK>
    <RECORD_x0020_NUMBER>178461</RECORD_x0020_NUMBER>
    <NAME_x0020_STATUS>Invalid</NAME_x0020_STATUS>
  </IndexFungorum>
  <IndexFungorum>
    <NAME_x0020_OF_x0020_FUNGUS>Amanita phalloides</NAME_x0020_OF_x0020_FUNGUS>
    <AUTHORS>(Vaill. ex Fr.) Link</AUTHORS>
    <INFRASPECIFIC_x0020_RANK>sp.</INFRASPECIFIC_x0020_RANK>
    <RECORD_x0020_NUMBER>178962</RECORD_x0020_NUMBER>
    <CURRENT_x0020_NAME>Amanita phalloides</CURRENT_x0020_NAME>
    <CURRENT_x0020_NAME_x0020_RECORD_x0020_NUMBER>178962</CURRENT_x0020_NAME_x0020_RECORD_x0020_NUMBER>
    <NAME_x0020_STATUS>Legitimate</NAME_x0020_STATUS>
  </IndexFungorum>
  <IndexFungorum>
    <NAME_x0020_OF_x0020_FUNGUS>Amanita phalloides f. citrina</NAME_x0020_OF_x0020_FUNGUS>
    <INFRASPECIFIC_x0020_RANK>f.</INFRASPECIFIC_x0020_RANK>
    <CURRENT_x0020_NAME>Amanita phalloides</CURRENT_x0020_NAME>
    <CURRENT_x0020_NAME_x0020_RECORD_x0020_NUMBER>178962</CURRENT_x0020_NAME_x0020_RECORD_x0020_NUMBER>
    <NAME_x0020_STATUS>Legitimate</NAME_x0020_STATUS>
  </IndexFungorum>
</NewDataSet>`

describe('Species Fungorum names', () => {
  it('reads each record', () => {
    const records = parseRecords(reply)
    expect(records).toHaveLength(3)
    expect(records[0]).toEqual({
      name: 'Amanita phalloides',
      rank: 'sp.',
      status: 'Invalid',
      current: undefined,
      currentRecord: undefined,
    })
  })

  it('takes the current name from the placed species record, not an invalid homonym', () => {
    expect(currentName('Amanita phalloides', parseRecords(reply))).toEqual({
      name: 'Amanita phalloides',
      record: 178962,
    })
  })

  it('reports a name that has moved', () => {
    const moved = reply.replace(
      /<CURRENT_x0020_NAME>Amanita phalloides<\/CURRENT_x0020_NAME>/,
      '<CURRENT_x0020_NAME>Amanita newname</CURRENT_x0020_NAME>',
    )
    expect(currentName('Amanita phalloides', parseRecords(moved))?.name).toBe('Amanita newname')
  })

  it('knows nothing of a name it has no species record for', () => {
    expect(currentName('Amanita imaginaria', parseRecords(reply))).toBeUndefined()
  })
})
