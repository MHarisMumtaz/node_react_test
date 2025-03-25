const MeetingHistory = require('../../model/schema/meeting')
const mongoose = require('mongoose');

const add = async (req, res) => {
    try {
        const { agenda, attendes, attendesLead, location, related, dateTime, notes, createBy } = req.body;

        let invalidObjectIdError = null;
        attendesLead?.forEach(led => {
            if (!mongoose.Types.ObjectId.isValid(led)) {
                invalidObjectIdError = 'Invalid attendes value';
            }
        });

        attendes?.forEach(attende => {
            if (!mongoose.Types.ObjectId.isValid(attende)) {
                invalidObjectIdError = 'Invalid attendesLead value';
            }
        });
        if(invalidObjectIdError) {
            res.status(400).json({ error: invalidObjectIdError });
            return;
        }

        const meetingData = { agenda, notes, location, related, dateTime, createBy };

        if (attendes && attendes.length) {
            meetingData.attendes = attendes;
        }
        if (attendesLead && attendesLead.length) {
            meetingData.attendesLead = attendesLead;
        }
        const result = new MeetingHistory(meetingData);
        await result.save();
        res.status(200).json(result);
    } catch (err) {
        console.error('Failed to create meeting:', err);
        res.status(400).json({ error: 'Failed to create meeting : ', err });
    }
}

const index = async (req, res) => {
    try {
        const query = req.query
        query.deleted = false;

        let result = await MeetingHistory.aggregate([
            { $match: query },
            {
                $lookup: {
                    from: 'Contacts',  
                    localField: 'attendes', 
                    foreignField: '_id', 
                    as: 'attendes' 
                }
            },
            {
                $lookup: {
                    from: 'Leads',
                    localField: 'attendesLead',
                    foreignField: '_id',
                    as: 'attendesLead' 
                }
            },
            {
                $lookup: {
                    from: 'User',
                    localField: 'createBy',
                    foreignField: '_id',
                    as: 'users',
                    pipeline: [
                        { $project: { firstName: 1, lastName: 1 } }
                    ]
                }
            },
            {
                $addFields: {
                    createdByName: {
                        $concat: [
                            { $arrayElemAt: ["$users.firstName", 0] }, 
                            " ", 
                            { $arrayElemAt: ["$users.lastName", 0] }
                        ]
                    }
                }
            },
            {
                $project: {
                    users: 0 // Exclude users completely
                }
            }
        ]);
          
        res.send(result)
    } catch (error) {
        res.send(error)
    }
}

const view = async (req, res) => {
    try {
        let response = await MeetingHistory.findOne({ _id: req.params.id })
        if (!response) return res.status(404).json({ message: "no Data Found." })

        let result = await MeetingHistory.aggregate([
            { $match: { _id: response._id } },
            {
                $lookup: {
                    from: 'Contacts',
                    localField: 'attendes',
                    foreignField: '_id',
                    as: 'attendes'
                }
            },
            {
                $lookup: {
                    from: 'Leads',
                    localField: 'attendesLead',
                    foreignField: '_id',
                    as: 'attendesLead'
                }
            },
            {
                $lookup: {
                    from: 'User',
                    localField: 'createBy',
                    foreignField: '_id',
                    as: 'users'
                }
            },
            { 
                $match: { 
                    $or: [
                        { users: { $exists: false } },
                        { 'users.deleted': false }
                    ] 
                } 
            },
            {
                $addFields: {
                    createdByName: { $arrayElemAt: ["$users.username", 0] } // Get first user
                }
            },
        ]);
        res.status(200).json(result[0]);

    } catch (err) {
        res.status(400).json({ Error: err });
    }
}

const deleteData = async (req, res) => {
    try {
        const result = await MeetingHistory.findByIdAndUpdate(req.params.id, { deleted: true });
        res.status(200).json({ message: "done", result })
    } catch (err) {
        res.status(404).json({ message: "error", err })
    }
}

const deleteMany = async (req, res) => {
    try {
        const result = await MeetingHistory.updateMany({ _id: { $in: req.body } }, { $set: { deleted: true } });

        if (result?.matchedCount > 0 && result?.modifiedCount > 0) {
            return res.status(200).json({ message: "Meetings Removed successfully", result });
        }
        else {
            return res.status(404).json({ success: false, message: "Failed to remove meetings" })
        }

    } catch (err) {
        return res.status(404).json({ success: false, message: "error", err });
    }
}

module.exports = { add, index, view, deleteData, deleteMany }