(function() {
	'use strict';


	process.env.debug_sql = true;


	var   log 			= require('ee-log')
		, assert 		= require('assert')
		, async 		= require('ee-async')
		, fs 			= require('fs')
		, ORM 			= require('related');



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
					, schema: 'related_nestedset_test'
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
			orm.getDatabase('related_nestedset_test').getConnection('write').then((connection) => {
                return new Promise((resolve, reject) => {
                    let exec = (index) => {
                        if (sqlStatments[index]) {
                            connection.query(sqlStatments[index]).then(() => {
                                exec(index + 1);
                            }).catch(reject);
                        }
                        else resolve();
                    }

                    exec(0);
                });
            }).then(() => {
                done();
            }).catch(done);
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

		return function(err, result) { //log(JSON.stringify(result));
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
			db = orm.related_nestedset_test;
			extension = new NestedSet();
		});


		it('should not crash when injected into the orm', function(done) {
			orm.use(extension);
			orm.reload(done);
		});

		it('set var should work ;)', function() {
			db = orm.related_nestedset_test;
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
			db = orm.related_nestedset_test;

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
			db = orm.related_nestedset_test;

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
			db = orm.related_nestedset_test;

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
			db = orm.related_nestedset_test;

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
			db = orm.related_nestedset_test;

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
			db = orm.related_nestedset_test;

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

		it('setting myself as parent should fail!', function(done) {
			db.tree({id: 7}).findOne(function(err, node) {
				if (err) done(err);
				else {
					node.setParent(7).save(function(err, movedNode) {
						if (err) done();
						else done(new Error('self references are not ok!'));
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







	describe('[Perparation for the Group Key Tests]', function() {
		it('truncating the table', function(done) {
			db.tree().delete(done);
		});

		it('setting the group key', function() {
			extension.setGroupKey('related_nestedset_test', 'tree', 'group');
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
		it('should set corrent position parameters when inserting a node', function(done) {
			new db.tree({name: 'root1', group:999}).setParent().save(function(err, node) {
				if (err) done(err);
				else {
					assert.equal(node.left, 1);
					assert.equal(node.right, 2);
					done();
				}
			});
		});

		it('should set corrent position parameters when inserting a node another group', function(done) {
			new db.tree({name: 'thirdTree', group:1}).setParent().save(function(err, node) {
				if (err) done(err);
				else {
					assert.equal(node.left, 1);
					assert.equal(node.right, 2);
					done();
				}
			});
		});

		it('should set corrent position parameters when inserting a root node above another node', function(done) {
			db = orm.related_nestedset_test;

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
			db = orm.related_nestedset_test;

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
			db = orm.related_nestedset_test;

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
			db = orm.related_nestedset_test;

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
			db = orm.related_nestedset_test;

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
			db = orm.related_nestedset_test;

			db.tree({name: 'child1.2', group: 999}, ['*']).findOne(function(err, model) {
				if (err) done(err);
				else {
					new db.tree({name: 'child1.4', group: 999}).before(23).save(function(err, node) {
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
			db.tree({id: 23}, '*').findOne(function(err, node) {
				if (err) done(err);
				else {
					node.setParent(20).save(function(err, movedNode) {
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
			db.tree({id: 25}, '*').findOne(function(err, node) {
				if (err) done(err);
				else {
					node.setParent(21).save(function(err, movedNode) {
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

		it('setting a new parent from another group should fail', function(done) {
			db.tree({id: 24}, '*').findOne(function(err, node) {
				if (err) done(err);
				else {
					node.setParent(19).save(function(err, movedNode) {
						if (err) done();
						else done(new Error('should not be able to set parents from another group!'));
					});
				}
			});
		});

		it('setting a new parent that is achild of the node should fail', function(done) {
			db.tree({id: 21}, '*').findOne(function(err, node) {
				if (err) done(err);
				else {
					node.setParent(25).save(function(err, movedNode) {
						if (err) done();
						else done(new Error('should not be able to set parents that are children of the same subtree!'));
					});
				}
			});
		});

		it('setting a new parent from another group should work when the group on the source was changed', function(done) {
			db.tree({id: 24}, '*').findOne(function(err, node) {
				if (err) done(err);
				else {
					node.group = 1;
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


		it('movin an entire subtree to another group', function(done) {
			var moverNode, parentNode;

			new db.tree({group: 333, name: '333-1'}).setParent().save().then(function(node) {
				return new db.tree({group: 333, name: '333-2'}).setParent(node).save();
			}).then(function(node) {
				parentNode = node;
				return new db.tree({group: 333, name: '333-3'}).setParent(node).save();
			}).then(function(node) {
				return new db.tree({group: 333, name: '333-4'}).setParent(node).save();
			}).then(function(node) {
				return new db.tree({group: 333, name: '333-5'}).setParent(node).save();
			}).then(function(node) {
				return new db.tree({group: 444, name: '444-1'}).setParent().save();
			}).then(function(node) {
				return new db.tree({group: 444, name: '444-2'}).setParent(node).save();
			}).then(function(node) {
				moverNode = node;
				return new db.tree({group: 444, name: '444-3'}).setParent(node).save();
			}).then(function(node) {
				return new db.tree({group: 444, name: '444-4'}).setParent(node).save();
			}).then(function(node) {
				return new db.tree({group: 444, name: '444-5'}).setParent(node).save();
			}).then(function(node) {
				return new db.tree({group: 444, name: '444-6'}).setParent(node).save();
			}).then(function(node) {
				return db.tree().loadTree(444);
			}).then(function(tree) {
				assert(JSON.stringify(tree) == '[{"id":31,"name":"444-1","group":444,"left":1,"right":12,"children":[{"id":32,"name":"444-2","group":444,"left":2,"right":11,"children":[{"id":33,"name":"444-3","group":444,"left":3,"right":10,"children":[{"id":34,"name":"444-4","group":444,"left":4,"right":9,"children":[{"id":35,"name":"444-5","group":444,"left":5,"right":8,"children":[{"id":36,"name":"444-6","group":444,"left":6,"right":7}]}]}]}]}]}]');
				return db.tree().loadTree(333);
			}).then(function(tree) {
				assert(JSON.stringify(tree) == '[{"id":26,"name":"333-1","group":333,"left":1,"right":10,"children":[{"id":27,"name":"333-2","group":333,"left":2,"right":9,"children":[{"id":28,"name":"333-3","group":333,"left":3,"right":8,"children":[{"id":29,"name":"333-4","group":333,"left":4,"right":7,"children":[{"id":30,"name":"333-5","group":333,"left":5,"right":6}]}]}]}]}]');

				moverNode.group = 333;
				return moverNode.setParent(parentNode).save();
			}).then(function() {
				return db.tree().loadTree(333);
			}).then(function(tree) {
				assert(JSON.stringify(tree) == '[{"id":26,"name":"333-1","group":333,"left":1,"right":20,"children":[{"id":27,"name":"333-2","group":333,"left":2,"right":19,"children":[{"id":32,"name":"444-2","group":333,"left":3,"right":12,"children":[{"id":33,"name":"444-3","group":333,"left":4,"right":11,"children":[{"id":34,"name":"444-4","group":333,"left":5,"right":10,"children":[{"id":35,"name":"444-5","group":333,"left":6,"right":9,"children":[{"id":36,"name":"444-6","group":333,"left":7,"right":8}]}]}]}]},{"id":28,"name":"333-3","group":333,"left":13,"right":18,"children":[{"id":29,"name":"333-4","group":333,"left":14,"right":17,"children":[{"id":30,"name":"333-5","group":333,"left":15,"right":16}]}]}]}]}]');

				return db.tree({group: ORM.in(333, 444)}).delete();
			}).then(function() {
				done();
			}).catch(done);
		});
	});


	describe('[Deleting]', function() {
		it('deleting a node containing children should not be possible', function(done) {
			db.tree({id: 20}).findOne(function(err, node) {
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
			db.tree({id: 24}).findOne(function(err, node) {
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
			db.tree().loadTree(999, expect('[{"id":20,"name":"root2","group":999,"left":1,"right":4,"children":[{"id":23,"name":"child1.2","group":999,"left":2,"right":3}]},{"id":18,"name":"root1","group":999,"left":5,"right":8,"children":[{"id":22,"name":"child1.1","group":999,"left":6,"right":7}]},{"id":21,"name":"root3","group":999,"left":9,"right":12,"children":[{"id":25,"name":"child1.4","group":999,"left":10,"right":11}]}]', done));
		});
	});



	describe('[Tree Syncing]', function() {
		it('updating an exsisting tree', function(done) {
			db.tree().loadTree(999, function(err, tree) {
				if (err) done(err);
				else {
					tree[1].children = [];
					tree[2].children.push({});

					db.tree().syncTree(tree, expect('[{"id":20,"name":"root2","group":999,"left":1,"right":4,"children":[{"id":23,"name":"child1.2","group":999,"left":2,"right":3}]},{"id":18,"name":"root1","group":999,"left":5,"right":6},{"id":21,"name":"root3","group":999,"left":7,"right":12,"children":[{"id":25,"name":"child1.4","group":999,"left":8,"right":9},{"id":37,"name":null,"group":999,"left":10,"right":11}]}]', done));
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
			], expect('[{"id":38,"name":"1","group":999,"left":1,"right":2},{"id":39,"name":"2","group":999,"left":3,"right":12,"children":[{"id":40,"name":"2_1","group":999,"left":4,"right":5},{"id":41,"name":"2_2","group":999,"left":6,"right":7},{"id":42,"name":"2_3","group":999,"left":8,"right":11,"children":[{"id":43,"name":"2_3_1","group":999,"left":9,"right":10}]}]},{"id":44,"name":"3","group":999,"left":13,"right":14},{"id":45,"name":"4","group":999,"left":15,"right":16}]', done));
		});
	});
})();
