const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const mongoURI = "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";
mongoose.connect(mongoURI.trim()).then(() => console.log("✅ Database Connected")).catch(err => console.error("❌ DB Error", err));

// الموديلات
const User = mongoose.model('User', new mongoose.Schema({
    username: String, email: { type: String, unique: true }, password: String,
    device_info: String, enrolled_courses: { type: [String], default: [] }
}));

const Code = mongoose.model('Code', new mongoose.Schema({
    codeText: { type: String, unique: true }, course_id: String, isUsed: { type: Boolean, default: false }
}));

const Course = mongoose.model('Course', new mongoose.Schema({
    title: String, vid: String, thumb: String
}));

app.use(session({ secret: 'medo-platform-secret', resave: false, saveUninitialized: true }));

// --- المسارات ---
app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => res.render('login', { error: null }));
app.get('/signup', (req, res) => res.render('signup', { error: null }));

app.post('/signup', async (req, res) => {
    try { await User.create(req.body); res.redirect('/login'); } 
    catch (e) { res.render('signup', { error: "الإيميل مسجل مسبقاً" }); }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) {
        req.session.userId = user._id;
        return (email === "medo_elkber@gmail.com") ? res.redirect('/admin/dashboard') : res.redirect('/home');
    }
    res.render('login', { error: "بيانات غلط" });
});

app.get('/home', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    const allCourses = await Course.find();
    const device = req.headers['user-agent'];
    if (!user.device_info) await User.findByIdAndUpdate(user._id, { device_info: device });
    res.render('index', { user, courses: allCourses, deviceMatch: (user.device_info === device) });
});

app.post('/activate/:courseId', async (req, res) => {
    const { activationCode } = req.body;
    const codeDoc = await Code.findOne({ codeText: activationCode, isUsed: false });
    if (codeDoc) {
        await User.findByIdAndUpdate(req.session.userId, { $addToSet: { enrolled_courses: req.params.courseId } });
        await Code.findByIdAndUpdate(codeDoc._id, { isUsed: true });
        res.redirect('/home');
    } else { res.send("<script>alert('الكود خطأ أو مستخدم'); window.location.href='/home';</script>"); }
});

// --- لوحة التحكم (Admin) ---
app.get('/admin/dashboard', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    if (user.email !== "medo_elkber@gmail.com") return res.redirect('/home');
    const students = await User.find();
    const codes = await Code.find();
    res.render('admin', { students, codes });
});

app.post('/admin/add-course', async (req, res) => { await Course.create(req.body); res.redirect('/admin/dashboard'); });
app.post('/admin/add-code', async (req, res) => { await Code.create({ codeText: req.body.newCode }); res.redirect('/admin/dashboard'); });
app.get('/admin/reset-student/:id', async (req, res) => { await User.findByIdAndUpdate(req.params.id, { device_info: null }); res.redirect('/admin/dashboard'); });
app.get('/admin/delete-student/:id', async (req, res) => { await User.findByIdAndDelete(req.params.id); res.redirect('/admin/dashboard'); });

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

app.listen(3000, () => console.log("🚀 Server Ready"));
