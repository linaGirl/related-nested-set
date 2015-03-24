
	process.env.debug_sql = true;


	var   log 			= require('ee-log')
		, assert 		= require('assert')
		, async 		= require('ee-async')
		, fs 			= require('fs')
		, ORM 			= require('ee-orm');



	var   NestedSet = require('../')
		, sqlStatments
		, extension
		, orm
		, db;


	// sql for test db
	sqlStatments = fs.readFileSync(__dirname+'/db.postgres.sql').toString().split(';').map(function(input){
		return input.trim().replace(/\n/gi, ' ').replace(/\s{2,}/g, ' ')
	}).filter(function(item){
		return item.length;
	});



	describe('Travis', function(){
		it('should have set up the test db', function(done){
			var config;

			try {
				config = require('../config.js').db
			} catch(e) {
				config = [{
					  type: 'postgres'
					, schema: 'ee_orm_nestedset_test'
					, database: 'test'
					, hosts: [{
						  host 		: 'localhost'
						, username 	: 'postgres'
						, password 	: ''
						, port 		: 5432
						, mode 		: 'readwrite'
						, database 	: 'test'
					}]
				}];
			}

			this.timeout(5000);
			orm = new ORM(config);
			orm.load(done);
		});

		it('should be able to drop & create the testing schema ('+sqlStatments.length+' raw SQL queries)', function(done) {
			orm.getDatabase('ee_orm_nestedset_test').getConnection(function(err, connection) {
				if (err) done(err);
				else async.each(sqlStatments, connection.queryRaw.bind(connection), done);
			});
		});
	});


	var getJSON = function(input) {
		if (Array.isArray(input)) return input.map(getJSON);
		else if (typeof input === 'object') {
			var output = input.toJSON ? input.toJSON() : input;
			if (input.children) output.children = getJSON(input.children);
			return output;
		}
		else return input;
	}


	var expect = function(val, cb){
		if (typeof val === 'string') val = JSON.parse(val);

		return function(err, result) { //log(getJSON(result), val, JSON.stringify(result), JSON.stringify(val));
			try {
				assert.deepEqual(getJSON(result), val);
			} catch (err) {
				return cb(err);
			}
			cb();
		}
	};


	describe('The NestedSet Extension', function() {
		var oldDate;

		it('should not crash when instatiated', function() {
			db = orm.ee_orm_nestedset_test;
			extension = new NestedSet();
		});


		it('should not crash when injected into the orm', function(done) {
			orm.use(extension);
			orm.reload(done);
		});

		it('set var should work ;)', function() {
			db = orm.ee_orm_nestedset_test;
		});


	});

	describe('[Inserting]', function() {
		it('should set corrent position parameters when inserting records', function(done) {


			new db.tree({name: 'root1'}).setParent().save(function(err, node) {
				if (err) done(err);
				else {
					assert.equal(node.left, 1);
					assert.equal(node.right, 2);
					done();
				}
			});
		});

		it('should set corrent position parameters when inserting a root node above another node', function(done) {
			db = orm.ee_orm_nestedset_test;

			new db.tree({name: 'root2'}).setParent().save(function(err, node) {
				if (err) done(err);
				else {
					assert.equal(node.left, 1);
					assert.equal(node.right, 2);
					done();
				}
			});
		});


		it('should set corrent position parameters when inserting a root node below another node', function(done) {
			db = orm.ee_orm_nestedset_test;

			new db.tree({name: 'root3'}).setParent(null, true).save(function(err, node) {
				if (err) done(err);
				else {
					assert.equal(node.left, 5);
					assert.equal(node.right, 6);
					done();
				}
			});
		});



		it('should set corrent position parameters when inserting a node as child of another node using an id', function(done) {
			db = orm.ee_orm_nestedset_test;

			new db.tree({name: 'child1.1'}).setParent(1).save(function(err, node) {
				if (err) done(err);
				else {
					assert.equal(node.left, 4);
					assert.equal(node.right, 5);
					done();
				}
			});
		});



		it('should set corrent position parameters when inserting a node as child of another node using a query', function(done) {
			db = orm.ee_orm_nestedset_test;

			new db.tree({name: 'child1.2'}).setParent(db.tree({id:1})).save(function(err, node) {
				if (err) done(err);
				else {
					assert.equal(node.left, 4);
					assert.equal(node.right, 5);
					done();
				}
			});
		});



		it('should set corrent position parameters when inserting a node after another node using a model', function(done) {
			db = orm.ee_orm_nestedset_test;

			db.tree({name: 'child1.2'}, ['*']).findOne(function(err, model) {
				if (err) done(err);
				else {
					new db.tree({name: 'child1.3'}).after(model).save(function(err, node) {
						if (err) done(err);
						else {
							assert.equal(node.left, 6);
							assert.equal(node.right, 7);
							done();
						}
					});
				}
			});
		});



		it('should set corrent position parameters when inserting before another node using an id', function(done) {
			db = orm.ee_orm_nestedset_test;

			db.tree({name: 'child1.2'}, ['*']).findOne(function(err, model) {
				if (err) done(err);
				else {
					new db.tree({name: 'child1.4'}).before(5).save(function(err, node) {
						if (err) done(err);
						else {
							assert.equal(node.left, 4);
							assert.equal(node.right, 5);
							done();
						}
					});
				}
			});
		});
	});



	describe('[Updating]', function() {
		it('setting a new parent, moving left', function(done) {
			db.tree({id: 5}).findOne(function(err, node) {
				if (err) done(err);
				else {
					node.setParent(2).save(function(err, movedNode) {
						if (err) done(err);
						else {
							assert.equal(movedNode.left, 2);
							assert.equal(movedNode.right, 3);
							done();
						}
					});
				}
			});
		});

		it('setting a new parent, moving right', function(done) {
			db.tree({id: 7}).findOne(function(err, node) {
				if (err) done(err);
				else {
					node.setParent(3).save(function(err, movedNode) {
						if (err) done(err);
						else {
							assert.equal(movedNode.left, 12);
							assert.equal(movedNode.right, 13);
							done();
						}
					});
				}
			});
		});
	});




	describe('[Deleting]', function() {
		it('deleting a node containing children should not be possible', function(done) {
			db.tree({id: 2}).findOne(function(err, node) {
				if (err) done(err);
				else {
					node.delete(function(err, deletedNode) {
						assert(err instanceof Error);
						done();
					});
				}
			});
		});

		it('deleting a node not containing children', function(done) {
			db.tree({id: 5}).findOne(function(err, node) {
				if (err) done(err);
				else {
					node.delete(function(err, deletedNode) {
						if (err) done(err);
						else {
							assert.equal(deletedNode.isDeleted(), true);
							done();
						}
					});
				}
			});
		});
	});



	describe('[TreeBuilding]', function() {
		it('fetching the tree', function(done) {
			db.tree().loadTree(expect('[{"id":2,"name":"root2","right":2,"left":1,"group":null},{"id":1,"name":"root1","right":8,"left":3,"group":null,"children":[{"id":6,"name":"child1.3","right":5,"left":4,"group":null},{"id":4,"name":"child1.1","right":7,"left":6,"group":null}]},{"id":3,"name":"root3","right":12,"left":9,"group":null,"children":[{"id":7,"name":"child1.4","right":11,"left":10,"group":null}]}]', done));
		});
	});



	describe('[Tree Syncing]', function() {
		it('updating an exsiiting tree', function(done) {
			db.tree().loadTree(function(err, tree) {
				if (err) done(err);
				else {
					tree[1].children = [];
					tree[2].children.push({});

					db.tree().syncTree(tree, expect('[{"id":2,"left":1,"group":null,"name":"root2","right":2},{"id":1,"left":3,"group":null,"name":"root1","right":4},{"id":3,"left":5,"group":null,"name":"root3","right":10,"children":[{"id":7,"left":6,"group":null,"name":"child1.4","right":7},{"id":8,"left":8,"group":null,"name":null,"right":9}]}]', done));
				}
			});
		});

		it('truncating the table', function(done) {
			db.tree().delete(done);
		});

		it('creating a new tree', function(done) {
			db.tree().syncTree([
				  {name: '1'}
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
			], expect('[{"id":9,"group":null,"left":1,"right":2,"name":"1"},{"id":10,"group":null,"left":3,"right":12,"name":"2","children":[{"id":11,"group":null,"left":4,"right":5,"name":"2_1"},{"id":12,"group":null,"left":6,"right":7,"name":"2_2"},{"id":13,"group":null,"left":8,"right":11,"name":"2_3","children":[{"id":14,"group":null,"left":9,"right":10,"name":"2_3_1"}]}]},{"id":15,"group":null,"left":13,"right":14,"name":"3"},{"id":16,"group":null,"left":15,"right":16,"name":"4"}]', done));
		});
	});







	describe('Perparation for the Group Key Tests', function() {
		it('truncating the table', function(done) {
			db.tree().delete(done);
		});

		it('setting the group key', function() {
			extension.setGroupKey('ee_orm_nestedset_test', 'tree', 'group');
		});


		it('createing a second tree', function(done) {
			new db.tree({name: 'secondTree', group:1000}).setParent().save(function(err, node) {
				if (err) done(err);
				else {
					assert.equal(node.left, 1);
					assert.equal(node.right, 2);
					done();
				}
			});
		});
	});








	describe('[Inserting]', function() {
		it('should set corrent position parameters when inserting records', function(done) {
			new db.tree({name: 'root1', group:999}).setParent().save(function(err, node) {
				if (err) done(err);
				else {
					assert.equal(node.left, 1);
					assert.equal(node.right, 2);
					done();
				}
			});
		});

		it('should set corrent position parameters when inserting a root node above another node', function(done) {
			db = orm.ee_orm_nestedset_test;

			new db.tree({name: 'root2', group: 999}).setParent().save(function(err, node) {
				if (err) done(err);
				else {
					assert.equal(node.left, 1);
					assert.equal(node.right, 2);
					done();
				}
			});
		});


		it('should set corrent position parameters when inserting a root node below another node', function(done) {
			db = orm.ee_orm_nestedset_test;

			new db.tree({name: 'root3', group: 999}).setParent(null, true).save(function(err, node) {
				if (err) done(err);
				else {
					assert.equal(node.left, 5);
					assert.equal(node.right, 6);
					done();
				}
			});
		});



		it('should set corrent position parameters when inserting a node as child of another node using an id', function(done) {
			db = orm.ee_orm_nestedset_test;

			new db.tree({name: 'child1.1', group: 999}).setParent(18).save(function(err, node) {
				if (err) done(err);
				else {
					assert.equal(node.left, 4);
					assert.equal(node.right, 5);
					done();
				}
			});
		});



		it('should set corrent position parameters when inserting a node as child of another node using a query', function(done) {
			db = orm.ee_orm_nestedset_test;

			new db.tree({name: 'child1.2', group: 999}).setParent(db.tree({id:18})).save(function(err, node) {
				if (err) done(err);
				else {
					assert.equal(node.left, 4);
					assert.equal(node.right, 5);
					done();
				}
			});
		});



		it('should set corrent position parameters when inserting a node after another node using a model', function(done) {
			db = orm.ee_orm_nestedset_test;

			db.tree({name: 'child1.2', group: 999}, ['*']).findOne(function(err, model) {
				if (err) done(err);
				else {
					new db.tree({name: 'child1.3', group: 999}).after(model).save(function(err, node) {
						if (err) done(err);
						else {
							assert.equal(node.left, 6);
							assert.equal(node.right, 7);
							done();
						}
					});
				}
			});
		});



		it('should set corrent position parameters when inserting before another node using an id', function(done) {
			db = orm.ee_orm_nestedset_test;

			db.tree({name: 'child1.2', group: 999}, ['*']).findOne(function(err, model) {
				if (err) done(err);
				else {
					new db.tree({name: 'child1.4', group: 999}).before(22).save(function(err, node) {
						if (err) done(err);
						else {
							assert.equal(node.left, 4);
							assert.equal(node.right, 5);
							done();
						}
					});
				}
			});
		});
	});



	describe('[Updating]', function() {
		it('setting a new parent, moving left', function(done) {
			db.tree({id: 22}, '*').findOne(function(err, node) {
				if (err) done(err);
				else {
					node.setParent(19).save(function(err, movedNode) {
						if (err) done(err);
						else {
							assert.equal(movedNode.left, 2);
							assert.equal(movedNode.right, 3);
							done();
						}
					});
				}
			});
		});

		it('setting a new parent, moving right', function(done) {
			db.tree({id: 24}, '*').findOne(function(err, node) {
				if (err) done(err);
				else {
					node.setParent(20).save(function(err, movedNode) {
						if (err) done(err);
						else {
							assert.equal(movedNode.left, 12);
							assert.equal(movedNode.right, 13);
							done();
						}
					});
				}
			});
		});
	});



	describe('[Deleting]', function() {
		it('deleting a node containing children should not be possible', function(done) {
			db.tree({id: 19}).findOne(function(err, node) {
				if (err) done(err);
				else {
					node.delete(function(err, deletedNode) {
						assert(err instanceof Error);
						done();
					});
				}
			});
		});

		it('deleting a node not containing children', function(done) {
			db.tree({id: 23}).findOne(function(err, node) {
				if (err) done(err);
				else {
					node.delete(function(err, deletedNode) {
						if (err) done(err);
						else {
							assert.equal(deletedNode.isDeleted(), true);
							done();
						}
					});
				}
			});
		});
	});


	describe('[TreeBuilding]', function() {
		it('fetching the tree', function(done) {
			db.tree().loadTree(999, expect('[{"id":19,"name":"root2","group":999,"left":1,"right":4,"children":[{"id":22,"name":"child1.2","group":999,"left":2,"right":3}]},{"id":18,"name":"root1","group":999,"left":5,"right":8,"children":[{"id":21,"name":"child1.1","group":999,"left":6,"right":7}]},{"id":20,"name":"root3","group":999,"left":9,"right":12,"children":[{"id":24,"name":"child1.4","group":999,"left":10,"right":11}]}]', done));
		});
	});



	describe('[Tree Syncing]', function() {
		it('updating an exsisting tree', function(done) {
			db.tree().loadTree(999, function(err, tree) {
				if (err) done(err);
				else {
					tree[1].children = [];
					tree[2].children.push({});

					db.tree().syncTree(tree, expect('[{"id":19,"name":"root2","group":999,"left":1,"right":4,"children":[{"id":22,"name":"child1.2","group":999,"left":2,"right":3}]},{"id":18,"name":"root1","group":999,"left":5,"right":6},{"id":20,"name":"root3","group":999,"left":7,"right":12,"children":[{"id":24,"name":"child1.4","group":999,"left":8,"right":9},{"id":25,"name":null,"group":999,"left":10,"right":11}]}]', done));
				}
			});
		});

		it('the second tree should be correct', function(done) {
			db.tree().loadTree(1000, expect('[{"id":17,"name":"secondTree","group":1000,"left":1,"right":2}]', done));
		});

		it('truncating the table', function(done) {
			db.tree().delete(done);
		});

		it('creating a new tree', function(done) {
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
			], expect('[{"id":26,"name":"1","group":999,"left":1,"right":2},{"id":27,"name":"2","group":999,"left":3,"right":12,"children":[{"id":28,"name":"2_1","group":999,"left":4,"right":5},{"id":29,"name":"2_2","group":999,"left":6,"right":7},{"id":30,"name":"2_3","group":999,"left":8,"right":11,"children":[{"id":31,"name":"2_3_1","group":999,"left":9,"right":10}]}]},{"id":32,"name":"3","group":999,"left":13,"right":14},{"id":33,"name":"4","group":999,"left":15,"right":16}]', done));
		});
	});
