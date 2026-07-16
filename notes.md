"# FlexShop Manager - Interview Notes" 

1. database.js
Q1. orders table mein advance_payment aur advance_mode column hain. Agar ek customer order dete waqt cash deta hai, to in dono columns mein kya store hoga? Aur ye alag columns kyun hain — ek mein hi store kar sakte the na?
-- agar customer cash deta h to .... advance mode me cash store hoga and advance payment me amount store hogi jitni vo pay kr rha h... do table alag alag isliye h kyonki dono alag type ki information store krte h ... agar aise sidha likh de ki 500-Cash to ye bad design hota. and baad me filter krna bhi mushkil hota.
Alag columns = alag queries, alag filters, clean data.


Q2. payments table alag kyun hai orders table se? Dono mein payment related data hai — to ek hi table mein kyun nahi rakha?
-- beacuse 1 order ki multiple follow up payments ho skti h... agar orders table me hi rakhte to design acha nhi hota ...
One order → many payments. Isliye payments ek alag table hai with order_id foreign key. Yeh basic database design principle hai — "one to many relationship."



Q3. daily_records table ka kya kaam hai? Ye kab update hoti hai — har order pe, ya kuch aur?
-- daily_records ek summary table h ... expenses,payments,orders ye sab raw table entries h .. daily_records unka daily total store krta h... like today's total income = x, then today's total expense = y, then opening/closing cash balance=z... 
Yeh isliye hai taaki har baar daily ledger kholne pe system ko saari tables scan na karni pade — ek jagah se summary mil jaye.