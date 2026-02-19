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
mongoose.connect(mongoURI.trim()).then(() => console.log("✅ DB Connected"));

const User = mongoose.model('User', new mongoose.Schema({
    username: String, email: { type: String, unique: true }, password: String, 
    role: { type: String, default: 'student' },
    device_info: { type: String, default: "" }
}));

app.use(session({ 
    secret: 'medo-platform-secret-2026', 
    resave: false, 
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// بيانات الكورسات بالفيديوهات الصحيحة
const courses = [
    { id: "c1", title: "كورس البرمجة الشامل", vid: "dQw4w9WgXcQ", thumb: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=500" },
    { id: "c2", title: "احتراف التسويق", vid: "9Wp3-6n-8f0", thumb: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500" },
    { id: "c3", title: "كورس ميدو الجديد 🚀", vid: "ieaQmXn-uA4", thumb: "https://images.unsplash.com/photo-1587620962725-abab7fe55159?w=500" }
];

app.get('/', (req, res) => res.redirect('/login'));

app.get('/login', (req, res) => res.render('login', { error: req.query.error || null }));

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) {
        req.session.userId = user._id;
        if (email === "medo_elkber@gmail.com") {
            await User.findByIdAndUpdate(user._id, { role: 'admin' });
            return res.redirect('/admin/dashboard');
        }
        return res.redirect('/home');
    }
    res.redirect('/login?error=خطأ في بيانات الدخول');
});

app.get('/home', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    res.render('index', { user, courses });
});

// مسار مشاهدة الكورس المعدل
app.get('/course/:id', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const course = courses.find(c => c.id === req.params.id);
    if (!course) return res.redirect('/home');
    res.render('video', { course });
});

app.get('/admin/dashboard', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    if (!user || user.role !== 'admin') return res.redirect('/home');
    const students = await User.find({ role: 'student' });
    res.render('admin', { students, user });
});

app.get('/forgot-password', (req, res) => {
    const adminPhone = "201012345678"; // ضع رقمك الحقيقي هنا
    const msg = encodeURIComponent("أهلاً مستر ميدو، نسيت باسورد حسابي.");
    res.redirect(`https://wa.me/${adminPhone}?text=${msg}`);
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);

module.exports = app;
