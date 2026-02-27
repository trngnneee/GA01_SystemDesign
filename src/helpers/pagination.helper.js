function getPaginationRange(currentPage, totalPages) {
  const range = [];
  const maxVisible = 4;
  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) range.push({ number: i, type: 'number' });
  } else {
    range.push({ number: 1, type: 'number' });
    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);
    if (start > 2) range.push({ type: 'ellipsis' });
    for (let i = start; i <= end; i++) range.push({ number: i, type: 'number' });
    if (end < totalPages - 1) range.push({ type: 'ellipsis' });
    range.push({ number: totalPages, type: 'number' });
  }
  return range;
}

export default {
  getPaginationRange,
}