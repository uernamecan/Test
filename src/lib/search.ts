export function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase()
}

export function getSearchTerms(keyword: string) {
  return normalizeSearchText(keyword).split(/\s+/).filter(Boolean)
}

export function matchesSearchTerms(values: string[], keyword: string) {
  const terms = getSearchTerms(keyword)

  if (terms.length === 0) {
    return true
  }

  const haystack = normalizeSearchText(values.join(' '))

  return terms.every((term) => haystack.includes(term))
}
