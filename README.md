# Related ORM Nested Set Extension

Nested Sets for the [Related ORM](https://www.npmjs.com/package/ee-orm).

- Inserts, updates, deletes nested set nodes
- Support for multiple root nodes and multiple trees per table
- Works on any property names
- Prevents nodes with child nodes from being deleted

[![npm](https://img.shields.io/npm/dm/ee-orm-nested-set.svg?style=flat-square)](https://www.npmjs.com/package/v)
[![Travis](https://img.shields.io/travis/eventEmitter/ee-orm-nested-set.svg?style=flat-square)](https://travis-ci.org/eventEmitter/ee-orm-nested-set)
[![node](https://img.shields.io/node/v/ee-orm-nested-set.svg?style=flat-square)](https://nodejs.org/)

## API

### Importing and loading

Import

	var   ORM 		= require('ee-orm')
		, NestedSet = require('ee-orm-nested-set');

Load the ORM

	var orm = new ORM(dbConfig);

Load the extension using the default settings, the columns have the name `left` and `right`. The table contains one tree only.

	orm.use(new NestedSet());

Load using custom column names

	orm.use(new NestedSet({
		  left: 'lft'
		, right: 'rgt'
	}));

Load for a table containing multiple tree grouped by a column

	// myDB is the name of the db containing nested set table
	// myTable is the table containing the nested set
	orm.use(new NestedSet({
		myDB: {
			myTable: 'groupingColumn'
		}
	}));

You may also set the grouping key afterwards

	var nestedSet = new NestedSet();

	// add to orm
	orm.use(nestedSet);

    // when the orm is loaded everything should be ready
    orm.load(function(err) {

    	// add grouping
    	nestedSet.setGroupKey(databaseName, modelName, keyName);
    });


### loadTree method

Load a tree from a table which has only one tree stored in it
	
	orm.myDB.myTable().loadTree(function(err, tree){});

Load a tree with the id 234 from a table which has multiple trees stored in it

	orm.myDB.myTable().loadTree(234, function(err, tree){});

	querybuilder.loadTree(callback);


### setParent method

	model.setParent([primary key value | model instance | query builder], [as last child]);

This method can be called on any model instance of a nested set. It sets a new parentnode for the current node.

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


### after method

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



### before method

	model.before(primary key value | model instance | query builder);

Positions this model before another model on the same level

	// load a node from the table
	orm.tree({id:4}).findOne(function(err, node){

		// store before the node with the id 45
		node.before(45);


		// store before the modelInstanc
e		node.before(modelInstance);


		// store before the node with the name «charlie»
		node.before(orm.db.tree({name: 'charlie'}), true);


		// save changes
		node.save(function(err) {

		});
	});
