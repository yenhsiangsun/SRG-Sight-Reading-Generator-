/** Search controls and feedback follow localeOrder in messages.ts. */
export const searchMessages = {
  searchLibrary: ['搜尋收藏','Search library','コレクションを検索','Buscar en la colección','Sammlung durchsuchen','Rechercher dans la collection','보관함 검색','Pesquisar na coleção','Поиск в коллекции','Cerca nella raccolta','搜索收藏','ค้นหาในคลัง'],
  librarySearchHint: ['樂器、調式、拍號…','Instrument, mode, meter…','楽器・旋法・拍子…','Instrumento, modo, compás…','Instrument, Modus, Takt…','Instrument, mode, mesure…','악기, 선법, 박자…','Instrumento, modo, compasso…','Инструмент, лад, размер…','Strumento, modo, metro…','乐器、调式、拍号…','เครื่องดนตรี โหมด อัตราจังหวะ…'],
  librarySearchResults: ['顯示 {count} / {total} 份','Showing {count} of {total}','{total} 件中 {count} 件','{count} de {total}','{count} von {total}','{count} sur {total}','{total}개 중 {count}개','{count} de {total}','{count} из {total}','{count} di {total}','显示 {count} / {total} 份','แสดง {count} จาก {total}'],
  librarySearchEmpty: ['沒有符合的收藏，試試其他關鍵字。','No matching entries. Try another keyword.','一致する項目がありません。別の言葉をお試しください。','No hay resultados. Prueba otra palabra.','Keine passenden Einträge. Versuche ein anderes Suchwort.','Aucun résultat. Essayez un autre mot.','일치하는 항목이 없어요. 다른 검색어를 입력해 보세요.','Nenhum resultado. Tente outra palavra.','Ничего не найдено. Попробуйте другое слово.','Nessun risultato. Prova un’altra parola.','没有符合的收藏，试试其他关键词。','ไม่พบรายการที่ตรงกัน ลองใช้คำค้นอื่น'],
  clearInstrumentSearch: [
    '清除搜尋', 'Clear search', '検索をクリア', 'Borrar búsqueda',
    'Suche löschen', 'Effacer la recherche', '검색 지우기', 'Limpar pesquisa',
    'Очистить поиск', 'Cancella ricerca', '清除搜索', 'ล้างการค้นหา',
  ],
  allInstrumentFamilies: [
    '所有分類', 'All categories', 'すべての分類', 'Todas las categorías',
    'Alle Kategorien', 'Toutes les catégories', '모든 분류', 'Todas as categorias',
    'Все категории', 'Tutte le categorie', '所有分类', 'ทุกหมวดหมู่',
  ],
  instrumentSearchResults: [
    '{count} 種樂器 · {family}', 'Instruments: {count} · {family}', '楽器 {count} 件 · {family}',
    'Instrumentos: {count} · {family}', 'Instrumente: {count} · {family}', 'Instruments : {count} · {family}',
    '악기 {count}개 · {family}', 'Instrumentos: {count} · {family}', 'Инструменты: {count} · {family}',
    'Strumenti: {count} · {family}', '{count} 种乐器 · {family}', 'เครื่องดนตรี {count} ชนิด · {family}',
  ],
  instrumentSearchEmptyHelp: [
    '換個關鍵字或分類試試，已選樂器會保留。',
    'Try another keyword or category. Your selected instrument stays the same.',
    '別の言葉や分類で検索してください。選択中の楽器はそのままです。',
    'Prueba otra palabra o categoría. El instrumento seleccionado se mantiene.',
    'Versuche ein anderes Suchwort oder eine andere Kategorie. Dein gewähltes Instrument bleibt erhalten.',
    'Essayez un autre mot ou une autre catégorie. Votre instrument sélectionné reste inchangé.',
    '다른 검색어나 분류를 선택해 보세요. 선택한 악기는 유지돼요.',
    'Tente outra palavra ou categoria. O instrumento selecionado permanece o mesmo.',
    'Попробуйте другое слово или категорию. Выбранный инструмент сохранится.',
    'Prova un’altra parola o categoria. Lo strumento selezionato rimane invariato.',
    '换个关键词或分类试试，已选乐器会保留。',
    'ลองใช้คำค้นหรือหมวดหมู่อื่น เครื่องดนตรีที่เลือกไว้จะยังคงเดิม',
  ],
} as const;

export function searchNamed(index: 10 | 11) {
  return Object.fromEntries(Object.entries(searchMessages).map(([key, row]) => [key, row[index]])) as Record<keyof typeof searchMessages, string>;
}
