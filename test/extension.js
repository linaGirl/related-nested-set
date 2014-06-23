
	
	process.env.debug_sql = true;

	var   Class 		= require('ee-class')
		, log 			= require('ee-log')
		, assert 		= require('assert')
		, async 		= require('ee-async')
		, fs 			= require('fs')
		, ORM 			= require('ee-orm');



	var   TimeStamps = require('../')
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
				config = {
					ee_orm_timestamps_test: {
						  type: 'postgres'
						, hosts: [
							{
								  host 		: 'localhost'
								, username 	: 'postgres'
								, password 	: ''
								, port 		: 5432
								, mode 		: 'readwrite'
								, database 	: 'test'
							}
						]
					}
				};
			}

			this.timeout(5000);
			orm = new ORM(config);
			orm.on('load', done);
		});

		it('should be able to drop & create the testing schema ('+sqlStatments.length+' raw SQL queries)', function(done){
			orm.getDatabase('ee_orm_timestamps_test').getConnection(function(err, connection){
				if (err) done(err);
				else {
					async.each(sqlStatments, connection.queryRaw.bind(connection), done);
				}
			});				
		});
	});


	var expect = function(val, cb){
		return function(err, result){
			try {
				assert.equal(JSON.stringify(result), val);
			} catch (err) {
				return cb(err);
			}
			cb();
		}
	};


	describe('The TimeStamps Extension', function() {
		var oldDate;

		it('should not crash when instatiated', function() {
			db = orm.ee_orm_nestedset_test;
			extension = new TimeStamps();
		});


		it('should not crash when injected into the orm', function(done) {
			orm.use(extension);
			orm.reload(done);
		});


		it('should set correct timestamps when inserting a new record', function(done) {
			db = orm.ee_orm_nestedset_test;
			new db.event().save(function(err, evt) {
				if (err) done(err);
				else {
					assert.notEqual(evt.created, null);
					assert.notEqual(evt.updated, null);
					assert.equal(evt.deleted, null);
					oldDate = evt.updated;
					done();
				}
			});
		});
	});
	