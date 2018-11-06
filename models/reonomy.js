const mongoose = require('mongoose');

let reonomySchema = new mongoose.Schema({
    address: String,
    apn: String,
    dateCrawled: Date
});

let Reonomy = mongoose.model('Reonomy', reonomySchema);

module.exports = Reonomy;