var express = require('express');
var router = express.Router();

/*
 * GET test1.
 */
router.get('/data', function(req, res) {// '/test' is collection and '/test1' is collection
    var db = req.db;
    var collection = db.get('data');
    collection.find({},{},function(e,docs){
        res.json(docs);
    });
});

module.exports = router;
