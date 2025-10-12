const getModulesRepo = async ({ user }) => {
  const { client } = require("../../config/db-connect");
  const [modules] = await client.execute(
    `SELECT 
    tms.module_id, 
   (SELECT COUNT(*) FROM units WHERE units.module_id = tms.module_id) AS total_units,
    m.subject_name
    FROM teacher_modules tms
    LEFT JOIN modules m ON tms.module_id = m.module_id
    WHERE teacher_id = ?`,
    [user?.teacher_id]
  );
  return modules;
};
module.exports = { getModules: getModulesRepo };
