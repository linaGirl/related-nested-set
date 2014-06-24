# ee-orm-nested-set

Nested Set implementation for the ee-orm package. Inserts, updates, deletes nested set nodes, supporting concurrency. Fetches the tree for you from the DB. Supports multiple root nodes and multiple tree per table. Works on property names defined by you. Prevent nodes with childs from being deleted. it's simple :)

## installation

	npm install ee-orm-nested-set


## build status

[![Build Status](https://travis-ci.org/eventEmitter/ee-orm-nested-set.png?branch=master)](https://travis-ci.org/eventEmitter/ee-orm-nested-set)


## usage

The nested set has several options you can pass to it.
	var   ORM 		= require('ee-orm')
		, NestedSet = require('ee-orm-nested-set');

	var orm = new ORM(dbConfig);

	// create your instance, with the defaults set
	// uf the extension find a property named «left» and one named «right»
	// on a model it applies iteslf to it. 
	var nestedSet = new NestedSet();

    // you may also define your own property names, now it looks for models
    // with the «lft» and «rgt» properties
    var nestedSet = new NestedSet({
    	  left: 'lft'
    	, right: 'rgt'
    });

    // if you need to store more than one tree per table you may specify a column
    // which is used to separate the sets.
    // myDbName is the db sepcified in the ee-orm db config, myTableName is the table
    // to use this group key on
    new NestedSetExtension({
        myDbName: {
            myTableName: {
                groupKey: 'nestedSetId'
            }
        }
    });


    // attach the nested set to the orm instance
    orm.use(nestedSet);


    // when the orm is loaded everything should be ready
    orm.on('load', function(err) {

    });


#### loadTree method

	querybuilder.loadTree(callback);

The ee-orm querybilder exposes on all nested set tbale the loadTree method. you may build your query
as ususal, and call the loadTree method insted of the find method.

this call returns an array of root nodes (model instances) of the given nested set. you may access hte nodex using 
the children property of each node.

	
	orm.tree([*]).loadTree(function(err, tree){
		log(tree); // array containing all root nodes of the set
		log(tree[0].children); // array containing all children of the first root node
	});


#### setParent method

	model.setParent([primary key value | model instance | query builder], [as last child]);

This method can be called on any model instance of a nested set. it defines a new parentnode for the current node.

	// load a node from the table
	orm.tree({id:4}).findOne(function(err, node){

		// set as a new root node
		node.setParent();


		// set as child of another parent, using its the parent nodes id as reference
		node.setParent(45);


		// set as child of another model instance
		node.setParent(modelInstance);


		// set as last child of a node found using a query, set as last child
		node.setParent(orm.db.tree({name: 'charlie'}), true);


		// save changes
		node.save(function(err) {

		});
	});


#### after method

	model.after(primary key value | model instance | query builder);

Positions this model after another model on the same level

	// load a node from the table
	orm.tree({id:4}).findOne(function(err, node){

		// store after the node with the id 45
		node.after(45);


		// store after the modelInstance
		node.after(modelInstance);


		// store after the node with the name «charlie»
		node.after(orm.db.tree({name: 'charlie'}), true);


		// save changes
		node.save(function(err) {

		});
	});



#### before method

	model.before(primary key value | model instance | query builder);

Positions this model before another model on the same level

	// load a node from the table
	orm.tree({id:4}).findOne(function(err, node){

		// store before the node with the id 45
		node.before(45);


		// store before the modelInstance
		node.before(modelInstance);


		// store before the node with the name «charlie»
		node.before(orm.db.tree({name: 'charlie'}), true);


		// save changes
		node.save(function(err) {

		});
	});