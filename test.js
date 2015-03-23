

    var Class       = require('ee-class')
        , log       = require('ee-log')
        , async     = require('ee-async')
        , assert    = require('assert')
        , ORM       = require('ee-orm')
        , project   = require('ee-project')
        , Extension = require('./');

    var orm = new ORM(project.config.db);

    orm.use(new Extension({
        ee_orm_nestedset_test: {
            tree: 'group'
        }
    }));

    orm.load(function(err) {
        log('orm loaded');
        var   db = orm.ee_orm_nestedset_test
            , start;


        var done = function(err, data){
            if (err) log(err);
            log(data);
        }


        db.tree().syncTree([
              {name: '1', group: 999}
            , {
                  name: '2'
                , children:[
                     {name: '2_1'}
                    ,{name: '2_2'}
                    ,{
                          name: '2_3'
                        , children:[
                            {name: '2_3_1'}
                        ]
                    }
                ]
            }
            , {name: '3'}
            , {name: '4'}
        ], done);

    });
