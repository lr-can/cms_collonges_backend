require ('dotenv').config()

const config = {
    db: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PWD,
        database: process.env.DB_NAME,
        connectTimeout: 60000
    },
    listPerPage: 200,
};
module.exports = config;