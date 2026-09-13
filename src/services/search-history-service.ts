let searchHistory: string[] = []

function getSearchHistory() {
  return [...searchHistory]
}

function addSearchHistory(keyword: string) {
  const value = keyword.trim()
  if (!value) return getSearchHistory()

  const normalizedValue = value.toLowerCase()
  searchHistory = [
    value,
    ...searchHistory.filter((item) => item.toLowerCase() !== normalizedValue),
  ]
  return getSearchHistory()
}

function filterSearchHistory(keyword: string) {
  const query = keyword.trim().toLowerCase()
  if (!query) return getSearchHistory()
  return searchHistory.filter((item) => item.toLowerCase().includes(query))
}

export { addSearchHistory, filterSearchHistory, getSearchHistory }
