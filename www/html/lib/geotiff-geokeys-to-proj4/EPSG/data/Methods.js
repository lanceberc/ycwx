/**
 * Maps EPSG method codes to their Proj4 definitions
 * @type {Object}
 */
module.exports = {
	"9807": "tmerc",
	"9804": "merc",
	"9805": "merc",
	"1044": "merc",
	"1026": "merc +ellps=sphere",
	"9812": "omerc",
	"9818": "poly",
	"9815": "omerc",
	"9808": "tmerc +k_0=1",
	"1024": "merc",
	"9841": "merc +ellps=sphere",
	"9835": "cea",
	"9820": "laea",
	"9817": "lcc", // This is Lambert Conic Near-Conformal, a variation of the Lambert Conformal Conic (1 Parallel) projection, in which the series expansion was truncated to the third order, such that the projection is not fully conformal (source: https://www.bluemarblegeo.com/knowledgebase/calculator-2020sp1/projections/Lambert_Near_Conformal_Conic.htm). Since Proj4 doesn't support this projection, I think, we can assume that it's somewhat equal to Lambert Conic Conformal.
	"9801": "lcc",
	"9802": "lcc",
	"9834": "cea +ellps=sphere",
	"1051": "lcc +k_0=1.0000382",
	"1027": "laea +ellps=sphere",
	"9821": "laea +ellps=sphere",
	"9822": "aea",
	"9832": "aeqd",
	"1028": "eqc",
	"1029": "eqc +ellps=sphere",
	"9842": "eqc",
	"9823": "eqc +ellps=sphere",
	"9809": "sterea",
	"9810": "stere",
	"9829": "stere",
	"9806": "cass",
	"9833": "cass +hyperbolic",
	"9840": "ortho",
	"9811": "nzmg",
	"9827": "bonne",
	"1052": "col_urban",
	"1078": "eqearth",
	"9819": "krovak",
	"9813": "labrd",
	"9604": "molodensky",
	"9605": "molodensky +abridged",
}