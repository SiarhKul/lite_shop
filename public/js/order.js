document.querySelector("#lite-shop-order").onsubmit = function (event) {
	event.preventDefault();
	let username = document.querySelector("#username").value.trim();
	let phone = document.querySelector("#phone").value.trim();
	let email = document.querySelector("#email").value.trim();
	let address = document.querySelector("#address").value.trim();

	if (!document.querySelector("#rule").checked) {
		//с правилами не согласен
		Swal.fire({
			title: "Warning",
			text: "Read and accept the rule",
			type: "info",
			confirmButtonText: "Ok",
		});
		return false;
	}

	if (username == "" || phone == "" || email == "" || address == "") {
		//не заполнены поля
		Swal.fire({
			title: "Warning",
			text: "Fill all fields",
			type: "info",
			confirmButtonText: "Ok",
		});
		return false;
	}

	fetch("/finish-order", {
		method: "POST",
		body: JSON.stringify({
			username: username,
			phone: phone,
			address: address,
			email: email,
			key: JSON.parse(localStorage.getItem("cart")),
		}),
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
	})
		.then(function (response) {
			return response.text();
		})
		.then(function (body) {
			if (body == 1) {
				Swal.fire({
					title: "Success",
					text: "Success",
					type: "info",
					confirmButtonText: "Ok",
				});
			} else {
				Swal.fire({
					title: "Problem with mail",
					text: "Error",
					type: "error",
					confirmButtonText: "Ok",
				});
			}
		});
};

// app.post("/login", function (req, res) {
// 	console.log("=======================");
// 	console.log(req.body);
// 	console.log(req.body.login);
// 	console.log(req.body.password);
// 	console.log("=======================");
// 	con.query(
// 		'SELECT * FROM user WHERE login="' +
// 			req.body.login +
// 			'" and password="' +
// 			req.body.password +
// 			'"',
// 		function (error, result) {
// 			if (error) reject(error);
// 			console.log(result);
// 			console.log(result.length);
// 			if (result.length == 0) {
// 				console.log("error user not found");
// 				res.redirect("/login");
// 			} else {
// 				result = JSON.parse(JSON.stringify(result));
// 				res.cookie("hash", "blablabla");
// 				/**
// 				 * write hash to db
// 				 */
// 				sql = "UPDATE user  SET hash='blablabla' WHERE id=" + result[0]["id"];
// 				con.query(sql, function (error, resultQuery) {
// 					if (error) throw error;
// 					res.redirect("/admin");
// 				});
// 			}
// 		}
// 	);
// });
