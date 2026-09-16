type SearchableStory = { title: string; classification_search_labels: readonly string[] };

export function matchesStorySearch(story: SearchableStory, query: string) {
  const term = query.trim().toLowerCase();
  return story.title.toLowerCase().includes(term)
    || story.classification_search_labels.some((label) => label.toLowerCase().includes(term));
}
