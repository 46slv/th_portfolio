let currentTag: string | null = null;
let currentYear: string | null = null;

export function setTag(tag: string | null) {
  currentTag = tag;
}

export function setYear(year: string | null) {
  currentYear = year;
}

export function getTag() {
  return currentTag;
}

export function getYear() {
  return currentYear;
}

export function applyWorkFilters() {
  const tag = getTag();
  const year = getYear();
  const hasActiveFilter = Boolean(tag || year);

  document.querySelectorAll("button[data-filter-tag]").forEach((btn) => {
    btn.classList.remove("border-cyan-500", "text-cyan-400");
  });
  document
    .querySelector(`button[data-filter-tag="${tag ?? "__all__"}"]`)
    ?.classList.add("border-cyan-500", "text-cyan-400");

  document.querySelectorAll("button[data-filter-year]").forEach((btn) => {
    btn.classList.remove("border-cyan-500", "text-cyan-400");
  });
  document
    .querySelector(`button[data-filter-year="${year ?? "__all__"}"]`)
    ?.classList.add("border-cyan-500", "text-cyan-400");

  document.querySelectorAll<HTMLElement>("[data-work]").forEach((el) => {
    const tags = (el.dataset.tags || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const workYear = el.dataset.year;
    const tagMatch = !tag || tags.includes(tag);
    const yearMatch = !year || workYear === year;

    if (tagMatch && yearMatch) {
      el.classList.remove("is-inactive");
      el.classList.toggle("is-active", hasActiveFilter);
    } else {
      el.classList.add("is-inactive");
      el.classList.remove("is-active");
    }
  });

  window.dispatchEvent(new CustomEvent("work-filters-applied"));
}
