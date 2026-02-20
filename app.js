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

// الاتصال بالقاعدة - تأكد من فتح الـ IP في Atlas
const mongoURI = "mongodb+srv://medoelkber2_db_user:I7vueTTD6aU9xB4C@cluster0.dbtgo0g.mongodb.net/myPlatform?retryWrites=true&w=majority";
mongoose.connect(mongoURI.trim())
    .then(() => console.log("✅ Connected Successfully"))
    .catch(err => console.error("❌ Connection Error:", err));

// الموديلات
const User = mongoose.model('User', new mongoose.Schema({
    username: String, email: { type: String, unique: true }, password: String, 
    role: { type: String, default: 'student' }, device_info: String, is_active: { type: Boolean, default: false }
}));
const Code = mongoose.model('Code', new mongoose.Schema({ codeText: { type: String, unique: true }, isUsed: { type: Boolean, default: false } }));
const Course = mongoose.model('Course', new mongoose.Schema({ title: String, vid: String, thumb: String }));

app.use(session({ secret: 'medo-platform-secret', resave: false, saveUninitialized: false }));

// --- المسارات ---
app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => res.render('login', { error: req.query.error, success: req.query.success }));

app.get('/register', (req, res) => res.render('register', { error: req.query.error }));

app.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        await User.create({ username, email, password });
        res.redirect('/login?success=تم إنشاء الحساب بنجاح، سجل دخولك الآن');
    } catch (e) {
        res.redirect('/register?error=هذا البريد الإلكتروني مسجل بالفعل');
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) {
        req.session.userId = user._id;
        const device = req.headers['user-agent'];
        if (user.device_info && user.device_info !== device && user.role !== 'admin') return res.redirect('/login?error=جهاز مختلف');
        if (!user.device_info) await User.findByIdAndUpdate(user._id, { device_info: device });
        return (email === "medo_elkber@gmail.com") ? res.redirect('/admin/dashboard') : res.redirect('/home');
    }
    res.redirect('/login?error=بيانات الدخول غير صحيحة');
});

app.get('/home', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    const courses = await Course.find();
    res.render('index', { user, courses, error: req.query.error });
});

app.get('/admin/dashboard', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    if (user.role !== 'admin') return res.redirect('/home');
    const students = await User.find({ role: 'student' });
    const courses = await Course.find();
    const codes = await Code.find();
    res.render('admin', { students, courses, codes });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Live on Port ${PORT}`));
