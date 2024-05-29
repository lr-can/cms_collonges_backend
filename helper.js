function getOffset(currentPage = 1, listPerPage){
    return (currentPage - 1) * [listPerPage];
}

function emptyOrRows(rows){
    if(!rows){
        return [];
    }
    return rows;
}

async function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    getOffset,
    emptyOrRows,
    timeout
}