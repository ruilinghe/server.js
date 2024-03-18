const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'mdap',
    password: '123456',
    port: 5432,
  });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));


app.get('/api/raw-data', async (req, res) => {
    const { facilities, startDate, endDate } = req.query; // 从请求中提取参数

    // SQL 查询，假设 'facilities' 是一个数组，startDate 和 endDate 是字符串
    const queryText = `
        SELECT name, record_time, visitor
        FROM raw_data
        WHERE name = ANY($1::text[]) AND record_time BETWEEN $2 AND $3
        ORDER BY record_time;
    `;

    try {
        // 执行 SQL 查询
        const result = await pool.query(queryText, [facilities.split(','), startDate, endDate]);
        // 将查询结果返回给客户端
        res.json(result.rows);
    } catch (error) {
        console.error('Error executing query', error.stack);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/fixed-data', async (req, res) => {
    try {
        const result = await pool.query('SELECT facility_id, name, maximum_capacity, runtime FROM fixed_data;');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/facilities', async (req, res) => {
    try {
        const facilitiesData = await pool.query(
            'SELECT f.*, t.current_queue, t.wait_time, t.record_time FROM fixed_data f ' +
            'LEFT JOIN time_wait_data t ON f.facility_id = t.facility_id ' +
            'ORDER BY t.record_time DESC, f.facility_id LIMIT 9;'
        );
        res.json(facilitiesData.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/logs', async (req, res) => {
    try {
        const logsData = await pool.query('SELECT * FROM working_log ORDER BY timestamp DESC;');
        res.json(logsData.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/logs', async (req, res) => {
    try {
        const { facility_id, facility, log_type, message } = req.body;
        const newLog = await pool.query(
            'INSERT INTO working_log (facility, log_type, message) VALUES ($1, $2, $3) RETURNING *;',
            [facility, log_type, message]
        );
        res.json(newLog.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/facility-status', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM public.facility_status');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.get('/api/facility-status/:facility', async (req, res) => {
    const { facility} = req.params;
    try {
        const { rows } = await pool.query('SELECT * FROM public.facility_status WHERE name = $1', [facility]);
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).send('Facility not found');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.post('/api/facility-status/:facility', async (req, res) => {
    const { facility } = req.params;
    const { status } = req.body;  // 确保从请求体中接收'Normal', 'Crowded', 或 'Breakdown' 等状态
    try {
        const result = await pool.query(
            'UPDATE public.facility_status SET status = $1 WHERE name = $2 RETURNING *',
            [status, facility]
        );
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).send('Facility not found');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.get('/api/predict-data', async (req, res) => {
    const { facilities, startDate, endDate } = req.query;

    // 将facilities从字符串转换为数组，确保日期已经提供
    const facilityArray = facilities.split(',');

    // 您需要根据实际的预测模型和数据表结构来调整此SQL查询
    const queryText = `
        SELECT name, record_time, visitor
        FROM predict_data
        WHERE name = ANY($1::text[]) AND record_time BETWEEN $2 AND $3
        ORDER BY record_time;
    `;
    try {
        // 执行 SQL 查询
        const result = await pool.query(queryText, [facilityArray, startDate, endDate]);
        // 将查询结果返回给客户端
        res.json(result.rows);
    } catch (error) {
        console.error('Error executing query', error.stack);
        res.status(500).send('Internal Server Error');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

