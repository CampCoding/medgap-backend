const adminRoutes = [
  {
    admins: [
      {
        name: "roles",
        base_route: "roles",
        description: "Manage user roles",
        routes: [
          {
            name: "create",
            payload: [
              {
                title: "role_name",
                type: "string",
                required: true,
                description: "Name of the role"
              },
              {
                title: "description",
                type: "string",
                required: false,
                description: "Description of the role"
              }
            ],
            method: "POST"
          },
          {
            name: "delete",
            payload: [
              {
                title: "role_id",
                type: "string",
                required: true,
                description: "ID of the role to delete",
                notes: "Send In Params"
              }
            ],
            method: "DELETE"
          },
          {
            name: "update",
            payload: [
              {
                title: "role_id",
                type: "string",
                required: true,
                description: "ID of the role to update"
              },
              {
                title: "role_name",
                type: "string",
                required: false,
                description: "Updated name of the role"
              },
              {
                title: "description",
                type: "string",
                required: false,
                description: "Updated description of the role"
              }
            ]
          }
        ]
      },
      { 

        name: "permissions",  
      }
    ]
  },
  {}
];


module.exports = {
  adminRoutes
};