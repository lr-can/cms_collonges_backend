const { Duplex } = require('stream');

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
function bufferToStream(buffer) {  
    let stream = new Duplex();
    stream.push(buffer);
    stream.push(null);
    return stream;
  }

module.exports = {
    getOffset,
    emptyOrRows,
    timeout,
    bufferToStream
}