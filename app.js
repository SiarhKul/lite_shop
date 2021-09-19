const express = require("express");
const chalk = require("chalk");
let mysql = require("mysql");
let app = express();
let cookie = require("cookie");
let cookieParser = require("cookie-parser");
let amin = require("./admin");

let con = mysql.createConnection({
	host: "localhost",
	user: "root",
	password: "1qaz2WSX",
	database: "market",
});
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const nodemailer = require("nodemailer");
const admin = require("./admin");

app.use(cookieParser());
app.use(express.urlencoded());
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded());
app.set("view engine", "pug");
app.listen(5000, () => {
	console.log(chalk.red("NODE EXPRESS WORKING ON 5000 PORT"));
});

app.use(function (req, res, next) {
	if (req.originalUrl == "/admin" || req.originalUrl == "/admin-order") {
		admin(req, res, con, next);
	} else {
		next();
	}
});

app.get("/", (req, res) => {
	console.log(
		chalk
			.bgRgb(15, 100, 204)
			.inverse("---------------------Request was done to server")
	);

	let cat = new Promise((resolve, reject) => {
		con.query(
			"select id,name, cost, image, category from (select id,name,cost,image,category, if(if(@curr_category != category, @curr_category := category, '') != '', @k := 0, @k := @k + 1) as ind   from goods, ( select @curr_category := '' ) v ) goods where ind < 3",
			function (error, result, field) {
				if (error) return reject(error);
				resolve(result);
			}
		);
	});
	let catDescription = new Promise((resolve, reject) => {
		con.query("SELECT * FROM category", function (error, result, field) {
			if (error) return reject(error);
			resolve(result);
		});
	});

	Promise.all([cat, catDescription]).then(value => {
		res.render("index.pug", {
			goods: JSON.parse(JSON.stringify(value[0])),
			cat: JSON.parse(JSON.stringify(value[1])),
		});
	});
});

app.get("/cat", (req, res) => {
	let catId = req.query.id;

	let cat = new Promise((resolve, reject) => {
		con.query(`SELECT * FROM category WHERE id=${catId}`, (error, result) => {
			if (error) {
				reject(error);
			} else {
				resolve(result);
			}
		});
	});

	let goods = new Promise((resolve, reject) => {
		con.query(
			`SELECT * FROM  goods WHERE category=${catId}`,
			(error, result) => {
				if (error) {
					reject(error);
				} else {
					resolve(result);
				}
			}
		);
	});

	Promise.all([cat, goods]).then(value => {
		res.render("cat.pug", {
			cat: JSON.parse(JSON.stringify(value[0])),
			goods: JSON.parse(JSON.stringify(value[1])),
		});
	});
});

app.get("/goods", function (req, res) {
	con.query(
		"SELECT * FROM goods WHERE id=" + req.query.id,
		function (error, result, fields) {
			if (error) throw error;
			res.render("goods", { goods: JSON.parse(JSON.stringify(result)) });
		}
	);
});
app.get("/order", function (req, res) {
	res.render("order.pug");
});

app.post("/get-category-list", function (req, res) {
	con.query(
		"SELECT id, category FROM category",
		function (error, result, fields) {
			if (error) throw error;
			res.json(result);
		}
	);
});

app.post("/get-goods-info", function (req, res) {
	if (req.body.key.length != 0) {
		con.query(
			`SELECT id,name,cost FROM goods WHERE id IN (${req.body.key.join(",")})`,
			function (error, result, fields) {
				if (error) throw error;

				let goods = {};
				for (let i = 0; i < result.length; i++) {
					goods[result[i]["id"]] = result[i];
				}
				res.json(goods);
			}
		);
	} else {
		res.send("0");
	}
});

app.post("/finish-order", function (req, res) {
	if (req.body.key.length != 0) {
		let key = Object.keys(req.body.key);
		con.query(
			"SELECT id,name,cost FROM goods WHERE id IN (" + key.join(",") + ")",
			function (error, result, fields) {
				console.log(result);
				if (error) throw error;
				sendMail(req.body, result).catch(console.error);
				saveOrder(req.body, result);
				res.send("1");
			}
		);
	} else {
		res.send("0");
	}
});

app.get("/admin", (req, res) => {
	res.render("admin.pug", {});
});

//-----------------login

app.get("/login", (req, res) => {
	res.render("login.pug", {});
});

app.post("/login", (req, res) => {
	console.log("=======================");
	console.log(req.body);
	console.log(req.body.login);
	console.log(req.body.password);
	console.log("=======================");
	con.query(
		'SELECT * FROM user WHERE login="' +
			req.body.login +
			'" and password="' +
			req.body.password +
			'"',

		function (error, result) {
			if (error) {
				throw error;
			}

			if (result.length === 0) {
				console.log(chalk.red("no such user"));
				res.redirect("/login");
			} else {
				let userFromServer = JSON.parse(JSON.stringify(result));
				let hash = makeHash(32);
				res.cookie("hash", hash);
				res.cookie("id", result[0]["id"]);
				/** * write hash to db */
				sql =
					"UPDATE user  SET hash='" + hash + "' WHERE id=" + result[0]["id"];
				con.query(sql, function (error, resultQuery) {
					if (error) throw error;
					res.redirect("/admin");
				});
			}
		}
	);
});

//---------------admin-order

app.get("/admin-order", function (req, res) {
	con.query(
		`SELECT 
      shop_order.id as id,
      shop_order.user_id as user_id,
        shop_order.goods_id as goods_id,
        shop_order.goods_cost as goods_cost,
        shop_order.goods_amount as goods_amount,
        shop_order.total as total,
        from_unixtime(date,"%Y-%m-%d %h:%m") as human_date,
        user_info.user_name as user,
        user_info.user_phone as phone,
        user_info.address as address
    FROM 
      shop_order
    LEFT JOIN	
      user_info
    ON shop_order.user_id = user_info.id ORDER BY id DESC`,
		function (error, result, fields) {
			if (error) throw error;
			res.render("admin-order", { order: JSON.parse(JSON.stringify(result)) });
		}
	);
});

function saveOrder(data, result) {
	// data - информация о пользователе
	// result - сведения о товаре
	let sql;
	sql =
		"INSERT INTO user_info (user_name, user_phone, user_email, address) VALUES ('" +
		data.username +
		"','" +
		data.phone +
		"','" +
		data.email +
		"','" +
		data.address +
		"')";
	con.query(sql, function (error, resultQuery) {
		if (error) throw error;
		console.log("1 user info saved");
		console.log(resultQuery);
		let userId = resultQuery.insertId;
		date = new Date() / 1000;
		for (let i = 0; i < result.length; i++) {
			sql =
				"INSERT INTO shop_order(date, user_id, goods_id,goods_cost, goods_amount, total) VALUES (" +
				date +
				"," +
				userId +
				"," +
				result[i]["id"] +
				"," +
				result[i]["cost"] +
				"," +
				data.key[result[i]["id"]] +
				"," +
				data.key[result[i]["id"]] * result[i]["cost"] +
				")";
			con.query(sql, function (error, resultQuery) {
				if (error) throw error;
				console.log("1 goods saved");
			});
		}
	});
}

async function sendMail(data, result) {
	let testAccount = await nodemailer.createTestAccount();
	let transporter = nodemailer.createTransport({
		host: "smtp.ethereal.email",
		port: 587,
		secure: false, // true for 465, false for other ports
		auth: {
			user: testAccount.user, // generated ethereal user
			pass: testAccount.pass, // generated ethereal password
		},
	});
	let res = "<h2>Order in lite shop</h2>";
	let total = 0;
	for (let i = 0; i < result.length; i++) {
		res += `<p>${result[i]["name"]} - ${data.key[result[i]["id"]]} - ${
			result[i]["cost"] * data.key[result[i]["id"]]
		} uah</p>`;
		total += result[i]["cost"] * data.key[result[i]["id"]];
	}
	console.log(res);
	res += "<hr>";
	res += `Total ${total} uah`;
	res += `<hr>Phone: ${data.phone}`;
	res += `<hr>Username: ${data.username}`;
	res += `<hr>Address: ${data.address}`;
	res += `<hr>Email: ${data.email}`;

	let mailOption = {
		from: "<siarhkul@gmail.com>",
		to: "siarhkul@gmail.com," + data.email,
		subject: "Lite shop order",
		text: "Hello world",
		html: res,
	};

	let info = await transporter.sendMail(mailOption);
	console.log("MessageSent: %s", info.messageId);
	console.log("PreviewSent: %s", nodemailer.getTestMessageUrl(info));
	return true;
}

function makeHash(length) {
	var result = "";
	var characters =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	var charactersLength = characters.length;
	for (var i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result;
}
