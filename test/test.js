"use strict";

var fs = require('fs-promise');
var txtToSql = require('../lib/txt-to-sql.js');
var expect = require('expect.js');
var selfExplain = require('self-explain');
var differences = selfExplain.assert.allDifferences;
var changing = require('best-globals').changing;
var yaml = require('js-yaml');

function setIfFileExists(fileName, outObject, outProperty, options) {
    return fs.exists(fileName).then(function(exists) {
        if(exists) { return fs.readFile(fileName, (options || {encoding:'utf8'})); }
        return { notExists: true };
    }).then(function(content) {
        if(! content.notExists) { outObject[outProperty] = content; }
    });
}

function loadYamlIfFileExists(fileName) {
    var res = {};
    return setIfFileExists(fileName, res, 'all').then(function() {
        return yaml.safeLoad(res.all || {});
    });
}

var defaultExpectedResult;
function loadDefaultExpectedResult() {
    if(defaultExpectedResult) { return Promise.resolve(defaultExpectedResult); }
    return loadYamlIfFileExists('./test/fixtures/_default_.result.yaml').then(function(yml) {
       defaultExpectedResult = yml;
    });
}

function makeSqlArray(sqls) {
    return sqls.split(/(\r?\n){2}/g)
               .filter(function(sqls){ return !sqls.match(/^(\r?\n)$/); });
}

describe("fixtures", function(){
    [
        {path:'example-one'},
        {path:'pk-simple', changeExpected:function(exp) { exp.opts.separator = '\t'; }},
        {path:'pk-complex', changeExpected:function(exp) { exp.opts.separator = '|'; }},
        {path:'pk-complex-all', changeExpected:function(exp) { exp.opts.separator = '|';}},
        {path:'pk-very-simple', changeExpected:function(exp) { exp.opts.separator = ',';}},
        {path:'pk-very-simple2', changeExpected:function(exp) { exp.opts.separator = ',';}},
        {path:'pk-simple-nn', changeExpected:function(exp) { exp.opts.separator = '\t'; }},
        {path:'pk-complex-nn'},
        {path:'pk-complex-nn2'},
        {path:'pk-space-simple', changeExpected:function(exp) { exp.opts.separator = /\s+/; } },
        {path:'pk-enabled'},
        {path:'pk-disabled'},
        {path:'without-pk-2'},
        {path:'fields-unmod'},
        {path:'fields-lcnames'},
        {path:'fields-lcalpha'},
        {path:'fields-unmod-dups', changeExpected:function(exp) { delete exp.columns; }},
        {path:'fields-lcnames-dups', changeExpected:function(exp) { delete exp.columns; }},
        {path:'fields-lcalpha-dups', changeExpected:function(exp) { delete exp.columns; }},
        {path:'separator', changeExpected:function(exp) { exp.opts.separator = '/'; }},
        {path:'comma-align'},
        {path:'comma-align-nulls'},
        {path:'comma-align-one-column'},
        {path:'comma-align-with-max'},
        {path:'one-column-no-sep', changeExpected:function(exp) { exp.opts.separator = false; delete exp.columns; }},
        {path:'adapt'},
        {path:'column-names'},
        {path:'columns-with-spaces'},
        {path:'mysql-example-one'},
        {path:'mysql-pk-complex-all'},
        {path:'mysql-adapt'},
        {path:'sqlite-example-one'},
        {path:'sqlite-pk-complex-all'},
        {path:'sqlite-adapt'},
        {path:'mssql-example-one'},
        {path:'oracle-example-one'},
        {path:'invalid-utf8'},
        {path:'invalid-ansi', skip:true},
        {path:'with-drop-table'},
        {path:'mysql-with-drop-table'},
        {path:'sqlite-with-drop-table'},
        {path:'fields-ansi-lcalpha'}, // ansi
        {path:'mssql-comma-align'},
        {path:'mssql-with-drop-table'},
        {path:'oracle-with-drop-table', skip:true},
    ].forEach(function(fixture){
        if(fixture.skip) {
            it.skip("fixture: "+fixture.path);
        } else {
            it("fixture: "+fixture.path, function(done){
                var defaultOpts = {inputEncoding:'UTF8', outputEncoding:'UTF8'};
                var param={tableName:fixture.path};
                var expected={};
                var basePath='./test/fixtures/'+fixture.path;
                var prepared;
                setIfFileExists(basePath+'.in-opts.yaml', param, 'opts').then(function() {
                    if(param.opts) {
                        param.opts = changing(defaultOpts, yaml.safeLoad(param.opts));
                    } else {
                        param.opts = defaultOpts;
                    }
                    return setIfFileExists(basePath+'.txt', param, 'rawTable', {});
                }).then(function() {
                    return loadDefaultExpectedResult();
                }).then(function() {
                    return loadYamlIfFileExists(basePath+'.result.yaml');
                }).then(function(yml) {
                    expected = changing(JSON.parse(JSON.stringify(defaultExpectedResult)), yml);
                    if(param.opts.outputEncoding !== null && param.opts.outputEncoding !== 'UTF8') {
                        console.log("OE", param.opts.outputEncoding)
                        throw new Error('Unhandled output test! Re-think next setIfFileExists() line!!');
                    }
                    return setIfFileExists(basePath+'.sql', expected, 'sqls', {encoding: (! param.opts.outputEncoding ? 'binary' : 'utf8')});
                }).then(function() {
                    if(expected.sqls) {
                        expected.sqls = makeSqlArray(expected.sqls);
                    }
                    if(fixture.changeExpected) { fixture.changeExpected(expected); }
                }).then(function() {
                    //console.log('------------- param',param);
                    return txtToSql.prepare(param);
                }).then(function(preparedResult){
                    prepared = preparedResult;
                    return txtToSql.generateScripts(param);
                }).then(function(generated){
                    // prepared
                    expect(prepared.opts).to.eql(expected.opts);
                    if(expected.columns) { expect(prepared.columns).to.eql(expected.columns); }
                    // generated
                    expect(generated.errors).to.eql(expected.errors);
                    //console.log("E SQL", expected.sqls);  console.log("G sqls", generated.sqls);
                    expect(generated.sqls).to.eql(expected.sqls);
                    expect(differences(generated.sqls,expected.sqls)).to.eql(null);
                    // coherencia entre prepared y generated
                    expect(generated.errors).to.eql(prepared.errors);
               }).then(done,done);
            });   
        }
    });
});

describe("specials", function(){
    it("manage mixed line ends", function(done){
        var rawTable=new Buffer(
            "text-field;int-field;num-field;big;double\n"+
            "hello;1;3.141592;1234567890;1.12e-101\r\n"+
            ";;;0;0.0", 'binary'
        );
        Promise.resolve().then(function(){
            return txtToSql.generateScripts({tableName:'example-one', rawTable:rawTable});
        }).then(function(generated){
            return fs.readFile('./test/fixtures/example-one.sql', {encoding:'utf8'}).then(function(sqls){
                sqls = makeSqlArray(sqls);
                expect(generated.sqls).to.eql(sqls);
                expect(differences(generated.sqls,sqls)).to.eql(null);
                return;
            });
        }).then(done,done);
    });
});

describe("input errors", function(){
    var eNoTXT='no rawTable in input';
    var eNoTable='undefined table name';
    var eBadFieldFormat="inexistent column names format 'inexistent_format'";
    var optBadFieldFormat = {columnNamesFormat: 'inexistent_format'};
    var optColumnTxt = new Buffer(
        'text-field;int-field;num-field;big;double\n'+
        'hello;1;3.141592;1234567890;1.12e-101\n'+
        ';;;0;0.0', 'binary'
    );
    var optDummyTxt = new Buffer('dummy', 'binary');
    [
        { name:'no rawTable',
          param:{tableName:'t1'},
          errors:[eNoTXT]},
        { name:'no rawTable and tableName',
          param:{},
          errors:[eNoTable, eNoTXT]},
        { name:'no tableName and columnNamesFormat',
          param:{rawTable:optDummyTxt, opts:optBadFieldFormat},
          errors:[eNoTable, eBadFieldFormat]},
        { name:'unsupported engine',
          param:{tableName:'t1', rawTable:optDummyTxt, opts:{outputEngine: 'badEngineName'}},
          errors:["unsupported output engine 'badEngineName'"]},
        { name:'all bad params',
          param:{opts:optBadFieldFormat},
          errors:[eNoTable, eNoTXT, eBadFieldFormat]},
        { name:'wrong number of column names',
          param:{tableName:'t1', rawTable:optColumnTxt, opts:{columnNames:['one','two','three']}},
          errors:['wrong number of column names: expected 5, obtained 3']},
        { name:'duplicated column names',
          param:{tableName:'t1', rawTable:optColumnTxt, opts:{columnNames:['one','two','three','one','three']}},
          errors:["duplicated column name '\"one\"'", "duplicated column name '\"three\"'"]},
        { name:'unsupported encoding',
          param:{tableName:'t1', rawTable:optDummyTxt, opts:{outputEncoding: 'win1252'}},
          errors:["unsupported output encoding 'win1252'"]},
        { name:'unsupported encodings',
          param:{tableName:'t1', rawTable:optDummyTxt, opts:{outputEncoding: 'miEnco', inputEncoding: 'win1252'}},
          errors:["unsupported input encoding 'win1252'", "unsupported output encoding 'miEnco'"]},
        { name:'rawTable is not a Buffer',
          param:{tableName:'t1', rawTable:'not a buffer', opts:{columnNames:['one','two','three']}},
          errors:['info.rawTable must be an Buffer']},
    ].forEach(function(check){
        if(check.skip) {
            it.skip(check.name);
        } else {
            it(check.name, function(done){
                txtToSql.prepare(check.param).then(function(prepared){
                    expect(prepared.errors).to.eql(check.errors);
                }).then(done,done);
            });
        }
    });
});

describe("file encoding", function(){
    [
        { name:'ascii7', file:'ascii7.txt', type:'ASCII7' },
        { name:'utf8', file:'utf8.txt', type:'UTF8'},
        { name:'utf8-bom', file:'utf8-bom.txt', type:'UTF8' },
        { name:'ansi', file:'ansi.txt', type:'ANSI' }
    ].forEach(function(check){
        if(check.skip) {
            it.skip(check.name);
        } else {
            it(check.name, function(done){
                fs.readFile('./test/encoding/'+check.file).then(function(buffer){
                    return txtToSql.getEncoding(buffer);
                }).then(function(encoding) {
                    expect(encoding).to.eql(check.type);
                }).then(done,done);
            });
        }
    });
});

