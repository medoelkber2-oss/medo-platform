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
mongoose.connect(mongoURI.trim()).then(() => console.log("✅ Pro System Active"));

// موديل المستخدم مع دور (Role)
const User = mongoose.model('User', new mongoose.Schema({
    username: String, 
    email: { type: String, unique: true }, 
    password: String, 
    role: { type: String, default: 'student' }, // student or admin
    enrolled_courses: { type: [String], default: [] },
    device_info: { type: String, default: "" }
}));

const Code = mongoose.model('Code', new mongoose.Schema({
    code: { type: String, unique: true }, 
    course_id: String, 
    is_used: { type: Boolean, default: false },
    used_by: String
}));

app.use(session({ secret: 'medo-pro-secret', resave: false, saveUninitialized: true }));

// نظام الدروس (Playlist لكل كورس)
const courses = [
    { 
        id: "c1", 
        title: "كورس البرمجة الشامل", 
        lessons: [
            { title: "مقدمة البرمجة", vid: "dQw4w9WgXcQ" },
            { title: "أساسيات JavaScript", vid: "W6NZfCO5SIk" }
        ],
        thumb: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=500" 
    },
    { 
        id: "c2", 
        title: "احتراف التسويق", 
        lessons: [{ title: "مبادئ التسويق", vid: "9Wp3-6n-8f0" }],
        thumb: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500" 
    }
];

// --- المسارات ---

app.get('/home', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    const currentDevice = req.headers['user-agent'];
    let deviceMatch = !user.device_info || user.device_info === currentDevice;
    res.render('index', { courses, user, deviceMatch });
});

// لوحة التحكم للأدمن
app.get('/admin/dashboard', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    const admin = await User.findById(req.session.userId);
    if (admin.role !== 'admin') return res.send("غير مسموح لك");
    
    const students = await User.find({ role: 'student' });
    const codes = await Code.find();
    res.render('admin', { students, codes });
});

// تصفير جهاز طالب (Reset Device)
app.get('/admin/reset/:id', async (req, res) => {
    await User.findByIdAndUpdate(req.params.id, { device_info: "" });
    res.redirect('/admin/dashboard');
});

// توليد أكواد
app.post('/admin/generate', async (req, res) => {
    const { courseId, count } = req.body;
    for(let i=0; i<count; i++) {
        let code = `MEDO-${courseId.toUpperCase()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
        await Code.create({ code, course_id: courseId });
    }
    res.redirect('/admin/dashboard');
});

app.post('/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, password: req.body.password });
    if (user) {
        req.session.userId = user._id;
        user.role === 'admin' ? res.redirect('/admin/dashboard') : res.redirect('/home');
    } else { res.send("بيانات خطأ"); }
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server on ${PORT}`));
module.exports = app;
