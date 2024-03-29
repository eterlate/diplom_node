const { Router } = require('express')
const { route } = require('express/lib/application')
const applications = require('../models/model')
const User = require('../models/User')
const router = Router()
const controller = require('../authController')
const { check } = require('express-validator')
const authMiddleware = require('../middleware/authMiddleware')
const roleMiddleware = require('../middleware/roleMiddleware')
const jwt = require('jsonwebtoken')
const { formatDateWrong, formatDateBack } = require('./functions')
const { data } = require('../data')
const pricelist = require('../models/pricelist')
const { response } = require('express')



// Главная
router.get('/', async (req, res) => {

    res.render('index', {
        title: 'EterService - главная',
        home: true
    })
})

//----------------------------------------Авторизация
// Регистрация
router.post('/registration', [
    check('username', 'Имя пользователя не может быть пустым').notEmpty(),
    check('password', 'Пароль должен быть больше 4 и меньше 15 символов').isLength({ min: 4, max: 15 }),
    check('phone_number', 'Неверный формат номера телефона').isMobilePhone('ru-RU')
],
    controller.registration)

//Страничка регистрации
router.get('/registration_page', (req, res) => {
    res.render('registration_page', {
        title: 'EterService - зарегистрироваться',
        cab:true
    })
})
//Логин
router.post('/login', controller.login)

//Страничка входа
router.get('/enter', (req, res) => {
    res.render('enter', {
        title: 'EterService - войти',
        cab: true
    })
})

//Выход из аккаунта
router.get('/out', (req, res) => {
    res.clearCookie('UserHash')
    res.clearCookie('UserData')
    res.redirect('/enter')
})
//----------------------------------------Кабинет и управление
// Кабинет админа
router.get('/adminCab', roleMiddleware(['ADMIN']), async (req, res) => {
    const massiv = await applications.find().lean()
    massiv.forEach(element => {
        if (element.date_create != null) {
            element.date_create = formatDateWrong(element.date_create)
        }
        if (element.date_visit != null) {
            element.date_visit = formatDateWrong(element.date_visit)
        }
        if (element.date_complete != null) {
            element.date_complete = formatDateWrong(element.date_complete)
        }
    })
    res.render('adminCab', {
        massiv,
        title: 'EterService - управление',
        cab: true
    })
})

//Приблизительная цена
router.post('/show_price', async (req, res) => {
    // res.status(200).json({message:"succes"})
    input_brand = req.body.brand
    input_model = req.body.model
    input_defect = req.body.defect
    card = await pricelist.find({ brand: input_brand, model: input_model, defect: input_defect })
    if (card.length == 0) {
        brand = pricelist.findOne({ brand: input_brand, model: null })
        defect = pricelist.findOne({ defect: input_defect, model: null })
        Promise.all([brand, defect]).then(result => {
            if (result[0] == null) {
                res.status(200).json({
                    price: result[1].price * 1.2
                })
            } else{
                price = result[0].coef * result[1].price
                res.status(200).json({
                    price
                })
            }
        }, err => {
            res.status(400).json({
                msg: err
            })
        })
    } else {
        res.status(200).json({
            price: card[0].price
        })
    }
})

// Кабинет работника
router.get('/workerCab', roleMiddleware(['WORKER']), async (req, res) => {
    const { cookies } = req
    const user = JSON.parse(cookies.UserData)
    const massiv = await applications.find({ worker: user.fio}).lean()
    massiv.forEach(element => {
        if (element.date_create != null) {
            element.date_create = formatDateWrong(element.date_create)
        }
        if (element.date_visit != null) {
            element.date_visit = formatDateWrong(element.date_visit)
        }
        if (element.date_complete != null) {
            element.date_complete = formatDateWrong(element.date_complete)
        }
    })
    res.render('workerCab', {
        massiv,
        title: 'EterService - управление',
        cab: true
    })
})

// Отметить выполнение для работника
router.get('/check_application', roleMiddleware(['WORKER']), async (req, res) => {
    now = new Date()
    const poc = await applications.findByIdAndUpdate(req.query._id, {
        status: 'Выполнена',
        date_complete: now
    })
    res.redirect('workerCab')
})



// Личный кабинет
router.get('/cab', authMiddleware, async (req, res) => {
    const { cookies } = req
    const phone = JSON.parse(cookies.UserData).phone_number
    const massiv = await applications.find({ phone_number: phone }).lean()
    massiv.forEach(element => {
        if (element.date_create != null) {
            element.date_create = formatDateWrong(element.date_create)
        }
        if (element.date_visit != null) {
            element.date_visit = formatDateWrong(element.date_visit)
        }
    })
    res.render('cab', {
        title: 'EterService - личный кабинет',
        massiv,
        cab: true
    })
})

//----------------------------------------Заявки

// Создание заявки
router.get('/create_application', (req, res) => {
    const { cookies } = req
    if ('UserData' in cookies) {
        const phone = JSON.parse(cookies.UserData).phone_number
        const fio = JSON.parse(cookies.UserData).fio
        res.render('create_application', {
            phone,
            fio,
            title: 'EterService - запись',
            create_application: true
        })
    } else {
        res.render('create_application', {
            title: 'EterService - запись',
            create_application: true
        })
    }


})

// Отправка заявки
router.post('/send_application', async (req, res) => {
    let now = new Date()
    const poc = new applications({
        phone_number: req.body.phone_number,
        fio: req.body.fio,
        device_type: req.body.device_type,
        brand: req.body.brand,
        model: req.body.model,
        defect: req.body.defect,
        comment: req.body.comment,
        date_visit: req.body.date_visit,
        date_create: now,
        approximate_cost: req.body.approximate_cost,
    })
    await poc.save()
    const {cookies} = req
    if('UserData' in cookies){
        res.redirect('/cab')
    }else{
        res.redirect('/')
    }
    

})

//----------------------------------------Странички
// Контакты
router.get('/contacts', (req, res) => {
    res.render('contacts', {
        title: 'EterService - Контакты',
        contacts: true
    })
})

//Страничка редактирования заявок
router.post('/edit_applications', (req, res) => {
        _id = req.body._id
        phone_number = req.body.phone_number,
        device_type = req.body.device_type,
        fio = req.body.fio
        brand = req.body.brand,
        model = req.body.model,
        defect = req.body.defect,
        comment = req.body.comment,
        admin_comment = req.body.admin_comment,
        date_visit = formatDateBack(req.body.date_visit),
        worker = req.body.worker,
        Status = req.body.status,
        approximate_cost = req.body.approximate_cost
        end_cost = req.body.end_cost
        date_complete = formatDateBack(req.body.date_complete)
    res.render('edit_applications', {
        _id,
        phone_number,
        device_type,
        brand,
        model,
        defect,
        comment,
        admin_comment,
        date_visit,
        Status,
        worker,
        end_cost,
        approximate_cost,
        date_complete,
        fio,
        title: 'EterService - редактировать',
        cab: true
    })
})

//Сохранение редактирования заявки
router.post('/save_applications', async (req, res) => {
    const poc = await applications.findByIdAndUpdate(req.body._id, {
        phone_number: req.body.phone_number,
        device_type: req.body.device_type,
        brand: req.body.brand,
        model: req.body.model,
        defect: req.body.defect,
        comment: req.body.comment,
        admin_comment: req.body.admin_comment,
        status: req.body.Status,
        worker: req.body.worker,
        fio: req.body.fio,
        date_visit: req.body.date_visit,
        approximate_cost: req.body.approximate_cost,
        end_cost: req.body.end_cost,
        date_complete: req.body.date_complete

    })
    res.redirect('/adminCab')
})

// Удаление заявки
router.get('/delete_application', async (req, res) => {
    await applications.findByIdAndDelete({ _id: req.query._id })
    res.redirect('/adminCab')
})



// router.post('/complete', async (req, res) => {
//     const poc = await model.findById(req.body.id)

//     // poc.completed = !!req.body.completed
//     await poc.save()
//     res.redirect('/')


// }
// )




module.exports = router