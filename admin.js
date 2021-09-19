module.exports = function (req, res, con, next) {
	if (req.cookies.hash == undefined || req.cookies.id == undefined) {
		res.redirect("/login");
		return false;
	}

	con.query(
		"SELECT * FROM user WHERE id=" +
			req.cookies.id +
			' and hash="' +
			req.cookies.hash +
			'"',
		function (error, result) {
			if (error) {
				console.log("ERROR");
			}

			if (result.length === 0) {
				console.log(chalk.red("no such user"));
				res.redirect("/login");
			} else {
				next();
			}
		}
	);
};
