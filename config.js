require ('dotenv').config()

const config = {
    db: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PWD,
        database: process.env.DB_NAME,
        port: 3307,
        connectTimeout: 60000
    },
    google:{
            "type": process.env.GG_type,
            "project_id": process.env.GG_project_id,
            "private_key_id": process.env.GG_private_key_id,
            "private_key": process.env.GG_private_key,
            "client_email": process.env.GG_client_email,
            "client_id": process.env.GG_client_id,
            "auth_uri": process.env.GG_auth_uri,
            "token_uri": process.env.GG_token_uri,
            "auth_provider_x509_cert_url": process.env.GG_auth_provider_x509_cert_url,
            "client_x509_cert_url": process.env.GG_client_x509_cert_url,
            "universe_domain": process.env.GG_universe_domain,
            "script_id": process.env.GG_script_id,
            "script_function": process.env.GG_script_function,
            "spreadsheetId": process.env.GG_spreadsheetId,
            "spreadsheetId2": process.env.GG_spreadsheetId2
    },
    listPerPage: 10000000,
};
module.exports = config;